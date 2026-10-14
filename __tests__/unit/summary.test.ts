import { ServerTask, TaskState } from '@octopusdeploy/api-client'
import { getTaskUrl } from '../../src/api-wrapper'
import { buildStepSummary } from '../../src/summary'

const taskUrl = 'https://octopus.example.com/app#/Spaces-1/tasks/ServerTasks-123'

function serverTask(overrides: Partial<ServerTask>): ServerTask {
  return {
    Id: 'ServerTasks-123',
    Name: 'Deploy',
    Description: 'Deploy MyProject release 1.0.0 to Dev',
    State: TaskState.Success,
    Duration: '1 minute',
    IsCompleted: true,
    HasPendingInterruptions: false,
    HasWarningsOrErrors: false,
    Arguments: {},
    ...overrides
  }
}

describe('getTaskUrl', () => {
  test('builds the task url', () => {
    expect(getTaskUrl('https://octopus.example.com', 'Spaces-1', 'ServerTasks-123')).toBe(taskUrl)
  })

  test('ignores trailing slashes on the server url', () => {
    expect(getTaskUrl('https://octopus.example.com/', 'Spaces-1', 'ServerTasks-123')).toBe(taskUrl)
  })
})

describe('buildStepSummary', () => {
  test('summarises a successful task with a link to the task log', () => {
    const summary = buildStepSummary('ServerTasks-123', taskUrl, serverTask({}))

    expect(summary).toContain('### 🐙 Octopus Deploy task completed successfully')
    expect(summary).toContain(`| [Deploy MyProject release 1.0.0 to Dev](${taskUrl}) | ✅ Success | 1 minute |`)
    expect(summary).toContain(`[View the task log in Octopus Deploy](${taskUrl})`)
  })

  test('includes the error message for a failed task', () => {
    const summary = buildStepSummary(
      'ServerTasks-123',
      taskUrl,
      serverTask({ State: TaskState.Failed, ErrorMessage: 'The deployment failed\nStep 1 failed' })
    )

    expect(summary).toContain('### 🐙 Octopus Deploy task did not complete successfully')
    expect(summary).toContain('| ❌ Failed |')
    expect(summary).toContain('> The deployment failed\n> Step 1 failed')
  })

  test('escapes pipes in the task description', () => {
    const summary = buildStepSummary('ServerTasks-123', taskUrl, serverTask({ Description: 'Run a | b' }))

    expect(summary).toContain(`[Run a \\| b](${taskUrl})`)
  })

  test('still links to the task when its state is unknown', () => {
    const summary = buildStepSummary('ServerTasks-123', taskUrl, undefined)

    expect(summary).toContain('### 🐙 Could not determine Octopus Deploy task state')
    expect(summary).toContain(`[View task ServerTasks-123 in Octopus Deploy](${taskUrl})`)
  })
})
