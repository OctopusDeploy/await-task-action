import { ServerTask, TaskState } from '@octopusdeploy/api-client'

const stateIcons: Partial<Record<TaskState, string>> = {
  [TaskState.Success]: '✅',
  [TaskState.Failed]: '❌',
  [TaskState.TimedOut]: '⌛',
  [TaskState.Canceled]: '🚫'
}

// Table cells can't contain pipes or newlines
function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

export function buildStepSummary(serverTaskId: string, taskUrl: string, task: ServerTask | undefined): string {
  if (!task) {
    return [
      '### 🐙 Could not determine Octopus Deploy task state',
      '',
      `The task did not finish within the timeout, or its state could not be retrieved. [View task ${serverTaskId} in Octopus Deploy](${taskUrl})`,
      ''
    ].join('\n')
  }

  const heading =
    task.State === TaskState.Success
      ? '🐙 Octopus Deploy task completed successfully'
      : '🐙 Octopus Deploy task did not complete successfully'
  const state = `${stateIcons[task.State] ?? ''} ${task.State}`.trim()

  const lines = [
    `### ${heading}`,
    '',
    '| Task | State | Duration |',
    '| :--- | :--- | :--- |',
    `| [${escapeCell(task.Description || task.Name || serverTaskId)}](${taskUrl}) | ${state} | ${escapeCell(
      task.Duration ?? ''
    )} |`,
    ''
  ]

  if (task.ErrorMessage) {
    lines.push(`> ${task.ErrorMessage.replace(/\r?\n/g, '\n> ')}`, '')
  }

  lines.push(`[View the task log in Octopus Deploy](${taskUrl})`, '')

  return lines.join('\n')
}
