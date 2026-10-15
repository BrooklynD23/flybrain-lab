export const meta = {
  name: 'loop-build',
  description: 'Build the project wave by wave: parallel TDD tasks, per-task review, wave gate, commit, release review',
  whenToUse: 'Run from the project root to implement docs/WAVE-*.md until done or blocked. args: {from, to, maxFix}',
  phases: [
    { title: 'Plan', detail: 'list waves, check human prerequisites' },
    { title: 'Build', detail: 'per task: implement (sonnet) then review (opus), fix loop' },
    { title: 'Gate', detail: 'wave gate commands + wave review, fix loop, commit' },
    { title: 'Release', detail: 'final production-readiness review' },
  ],
}

// args: { from?: number, to?: number, maxFix?: number }
const A = args || {}
const FROM = A.from ?? 0
const TO = A.to ?? 99
const MAX_FIX = A.maxFix ?? 3

const STYLE = 'Output style: follow ~/.claude/rules/common/subagent-output.md (i-have-adhd). Keep returned text short; details go in files.'

const WAVES = {
  type: 'object',
  properties: {
    waves: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          file: { type: 'string' },
          title: { type: 'string' },
          done: { type: 'boolean' },
          humanMissing: { type: 'array', items: { type: 'string' } },
        },
        required: ['n', 'file', 'title', 'done', 'humanMissing'],
      },
    },
  },
  required: ['waves'],
}

const TASKS = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'string' }, title: { type: 'string' }, files: { type: 'array', items: { type: 'string' } } },
        required: ['id', 'title', 'files'],
      },
    },
    gateCommands: { type: 'array', items: { type: 'string' } },
    reviewFocus: { type: 'string' },
  },
  required: ['tasks', 'gateCommands', 'reviewFocus'],
}

const IMPL = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'failed', 'blocked'] },
    changedFiles: { type: 'array', items: { type: 'string' } },
    failureTail: { type: 'string' },
  },
  required: ['status', 'changedFiles'],
}

const VERDICT = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    blocking: {
      type: 'array',
      items: {
        type: 'object',
        properties: { where: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' } },
        required: ['where', 'issue', 'fix'],
      },
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['verdict', 'blocking'],
}

const fmt = (blocking) => blocking.map((b, i) => `${i + 1}. ${b.where}: ${b.issue} -> fix: ${b.fix}`).join('\n')

const implement = (task, wave, extra, label) =>
  agent(
    `Implement task ${task.id} ("${task.title}") from ${wave.file}. Owned files: ${task.files.join(', ')}.\n${extra}\n${STYLE}`,
    { agentType: 'loop-implementer', model: 'sonnet', phase: 'Build', label, schema: IMPL },
  )

const review = (task, wave, label) =>
  agent(
    `Task review of ${task.id} from ${wave.file}. Owned files: ${task.files.join(', ')}. Run its Acceptance commands. Production-ready?\n${STYLE}`,
    { agentType: 'loop-reviewer', model: 'opus', phase: 'Build', label, schema: VERDICT },
  )

// implement -> review -> fix loop; one replan + retry before giving up
async function buildTask(task, wave) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const impl = await implement(task, wave, attempt ? 'Task section was just rewritten by the planner. Re-read it.' : 'Follow TDD.', `impl:${task.id}`)
    if (impl && impl.status !== 'blocked') {
      for (let round = 0; round <= MAX_FIX; round++) {
        const v = await review(task, wave, `review:${task.id}#${round}`)
        if (v && v.verdict === 'pass') return { id: task.id, ok: true }
        if (!v || round === MAX_FIX) break
        await implement(task, wave, `FIX MODE. Blocking issues:\n${fmt(v.blocking)}`, `fix:${task.id}#${round + 1}`)
      }
    }
    if (attempt === 0) {
      log(`${task.id} not passing; asking planner to rewrite it`)
      await agent(
        `Replan task ${task.id} in ${wave.file}. It failed implementation/review ${MAX_FIX + 1} times` +
          (impl && impl.failureTail ? `; last failure:\n${impl.failureTail}` : '') +
          `\nInspect the current code, rewrite only that task section so it can pass.\n${STYLE}`,
        { agentType: 'loop-planner', model: 'opus', phase: 'Build', label: `replan:${task.id}` },
      )
    }
  }
  return { id: task.id, ok: false }
}

async function gateWave(wave, parsed) {
  for (let round = 0; round <= MAX_FIX; round++) {
    const v = await agent(
      `Wave review of ${wave.file}. Run gate commands: ${parsed.gateCommands.join(' && ')}. Review focus: ${parsed.reviewFocus}. Integration across all tasks of this wave. Production-ready?\n${STYLE}`,
      { agentType: 'loop-reviewer', model: 'opus', phase: 'Gate', label: `gate:W${wave.n}#${round}`, schema: VERDICT },
    )
    if (v && v.verdict === 'pass') return true
    if (!v || round === MAX_FIX) return false
    await agent(
      `FIX MODE for wave gate of ${wave.file}. You may edit any file this wave's tasks own. Blocking issues:\n${fmt(v.blocking)}\nRerun: ${parsed.gateCommands.join(' && ')}\n${STYLE}`,
      { agentType: 'loop-implementer', model: 'sonnet', phase: 'Gate', label: `gatefix:W${wave.n}#${round + 1}`, schema: IMPL },
    )
  }
  return false
}

phase('Plan')
const plan = await agent(
  `List every docs/WAVE-NN-*.md in order. Mark done=true if docs/STATUS.md says the wave passed its gate. For each "Human prerequisites" HUMAN doc, run its verification command; list unmet ones in humanMissing.\n${STYLE}`,
  { agentType: 'loop-planner', model: 'opus', effort: 'low', label: 'list-waves', schema: WAVES },
)
const todo = plan.waves.filter((w) => !w.done && w.n >= FROM && w.n <= TO).sort((a, b) => a.n - b.n)
log(`${todo.length} wave(s) to build: ${todo.map((w) => w.n).join(', ') || 'none'}`)

const finished = []
for (const wave of todo) {
  if (wave.humanMissing.length) {
    return { stoppedAt: wave.file, reason: `human setup needed: ${wave.humanMissing.join(', ')}`, finished }
  }
  phase('Build')
  const parsed = await agent(`Parse ${wave.file}: tasks (id, title, Files) and the Wave gate.\n${STYLE}`, {
    agentType: 'loop-planner', model: 'opus', effort: 'low', phase: 'Build', label: `parse:W${wave.n}`, schema: TASKS,
  })
  log(`WAVE-${wave.n}: ${parsed.tasks.length} parallel task(s)`)
  const results = await pipeline(parsed.tasks, (t) => buildTask(t, wave))
  const failed = parsed.tasks.filter((t, i) => !(results[i] && results[i].ok)).map((t) => t.id)
  if (failed.length) return { stoppedAt: wave.file, reason: `tasks failed review: ${failed.join(', ')}`, finished }

  phase('Gate')
  if (!(await gateWave(wave, parsed))) return { stoppedAt: wave.file, reason: 'wave gate failed', finished }
  await agent(
    `Wave ${wave.file} passed its gate. Commit: git add -A && git commit -m "feat: WAVE-${wave.n} ${wave.title}". Then mark it passed in docs/STATUS.md and commit that too.\n${STYLE}`,
    { agentType: 'loop-implementer', model: 'sonnet', effort: 'low', phase: 'Gate', label: `commit:W${wave.n}` },
  )
  finished.push(wave.file)
}

phase('Release')
const allDone = plan.waves.every((w) => w.done || finished.includes(w.file))
if (!allDone) return { finished, release: 'skipped: waves outside from/to range still open' }
const release = await agent(
  `Release review of the whole project. Full tests, E2E, build, secret scan, docs/HUMAN-* status. Ready to push to production? Do NOT push or deploy.\n${STYLE}`,
  { agentType: 'loop-reviewer', model: 'opus', effort: 'high', phase: 'Release', label: 'release', schema: VERDICT },
)
return { finished, release }
