# Building for testing

To test a branch in GitHub Actions, an updated `dist/index.js` file is required.

```
npm run build
git add dist/.
git commit -m "updating index.js"
git log -q -n 1 dist/index.js | less -F
```

From the log output take note of the commit hash and push to GitHub

In a test GitHub action you can use the branched build of the action by referencing the branch or commit hash, see [here](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsuses) for details on the `uses` syntax.

```yml
env:

steps:
  # ...
  - name: Await task in Octopus Deploy 🐙
    uses: OctopusDeploy/await-task-action@my-branch
    env:
      OCTOPUS_API_KEY: ${{ secrets.API_KEY  }}
      OCTOPUS_URL: ${{ secrets.SERVER }}
      OCTOPUS_SPACE: 'Outer Space'
    with:
      server_task_id: ${{ fromJson(steps.some_previous_deployment_step.outputs.server_tasks)[0].serverTaskId }}
```
