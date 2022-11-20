import * as inputs from '../../src/input-parameters'

test('get input parameters', () => {
  const inputParameters = inputs.getInputParameters()
  expect(inputParameters).toBeDefined()
  expect(inputParameters.serverTaskId).toBeDefined()
  expect(inputParameters.serverTaskId).toBe('ServerTasks-123')
})
