import { setGracefulCleanup } from 'tmp'

setGracefulCleanup()

process.env = Object.assign(process.env, {
  GITHUB_ACTION: '1',
  INPUT_SERVER: process.env['OCTOPUS_URL'],
  INPUT_API_KEY: process.env['OCTOPUS_API_KEY'],
  INPUT_SPACE: 'Default',
  INPUT_SERVER_TASK_ID: 'ServerTasks-123',
  INPUT_HIDE_PROGRESS: 'false',
  INPUT_CANCEL_ON_TIMEOUT: 'false'
})
