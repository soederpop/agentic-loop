---
status: completed
project: playbook-designer
costUsd: 1.78171695
turns: 38
toolCalls: 66
completedAt: '2026-03-24T09:47:36.332Z'
---


# Phase 3: Condition Tester

Add the ability to parse, display, and execute condition blocks from plays directly in the UI. This is the "motorcycle" — the killer feature that lets users test whether a play's conditions would pass right now against the live container, before the scheduler ever runs it.

The demoable outcome: open a play that has a Conditions section, see each code block rendered with a "Run" button. Click Run and see a green check or red X with the error message and return value. A "Check All" button runs every condition block in sequence.

## Deliverables

1. **Condition block display** in the play editor view
   - Parse the `## Conditions` section from the play markdown
   - Extract each fenced TypeScript code block
   - Render each block in a styled code panel with a "Run" button
   - Show result area beneath each block (initially empty)

2. **Condition execution UI**
   - Click "Run" on a condition block → POST to the eval endpoint → display result
   - Green check + return value if the block passes (returns truthy or doesn't throw)
   - Red X + error message if the block throws or returns false
   - Loading spinner during execution
   - "Check All" button that runs every condition sequentially and shows aggregate pass/fail

3. **API endpoint: `POST /api/plays/:slug/eval-condition`**
   - Accepts JSON with `code` (the condition block source) and optional `index` (which block)
   - Evaluates the code server-side using the `vm` feature with the real container in scope
   - Returns `{ passed: boolean, returnValue: any, error?: string, durationMs: number }`
   - Timeout protection (5 second max per block)

4. **Condition editing**
   - Allow editing condition blocks inline in the editor
   - New condition blocks can be added via a "+ Add Condition" button
   - Edited conditions are saved as part of the play markdown when the user saves

## References

- Phase 2 deliverables (play editor, save API)
- Prompt Studio notebook execution: `workflows/prompt-studio/` (VM block execution pattern)
- VM feature: `container.feature('vm')` — needs explicit global injection
- TaskScheduler condition evaluation: `features/task-scheduler.ts`
- Known gotcha: VM contexts start empty, must inject `console`, `Date`, `Promise`, `container`, etc.

## Verification

- Open a play with conditions — confirm each code block is displayed with a Run button
- Click Run on a condition that should pass — confirm green check and return value
- Click Run on a condition that should fail — confirm red X and error message
- Click "Check All" — confirm all blocks run and aggregate result is shown
- Edit a condition block, save, reload — confirm the edit persisted
- Add a new condition block, save — confirm it appears in the markdown file under `## Conditions`
- Confirm condition execution times out after 5 seconds for infinite loops
- Confirm the container is available in the VM context (test a condition that calls `container.docs`)
