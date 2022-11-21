import { getInputParameters } from '../../src/input-parameters'

test('get input parameters', () => {
  const inputParameters = getInputParameters()
  expect(inputParameters).toBeDefined()
  expect(inputParameters.serverTaskId).toBeDefined()
  expect(inputParameters.serverTaskId).toBe('ServerTasks-123')
})
