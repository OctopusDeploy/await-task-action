# await-task-action

<img alt= "" src="https://github.com/OctopusDeploy/deploy-release-untenanted-action/raw/main/assets/github-actions-octopus.png" />

This is a GitHub Action to wait/watch an execution in [Octopus Deploy](https://octopus.com/).

## Deployments in Octopus Deploy

A release is a snapshot of the deployment process and the associated assets (packages, scripts, variables) as they existed when the release was created. The release is given a version number, and you can deploy that release as many times as you need to, even if parts of the deployment process have changed since the release was created (those changes will be included in future releases but not in this version).

When you deploy the release, you are executing the deployment process with all the associated details, as they existed when the release was created.

More information about releases and deployments in Octopus Deploy:

- [Releases](https://octopus.com/docs/releases)
- [Deployments](https://octopus.com/docs/deployments)

## Examples

Incorporate the following actions in your workflow to wait for a task to complete in Octopus Deploy:

```yml
env:

steps:
  # ...
  - name: Await task in Octopus Deploy 🐙
    uses: OctopusDeploy/await-task-action@v3
    env:
      OCTOPUS_API_KEY: ${{ secrets.API_KEY  }}
      OCTOPUS_URL: ${{ secrets.SERVER }}
      OCTOPUS_SPACE: 'Outer Space'
    with:
      server_task_id: {{ steps.some_previous_deployment_step.outputs.server_tasks[0].server_task_id }}
```

## ✍️ Environment Variables

| Name              | Description                                                                                                                                          |
| :---------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `OCTOPUS_URL`     | The base URL hosting Octopus Deploy (i.e. `https://octopus.example.com`). It is strongly recommended that this value retrieved from a GitHub secret. |
| `OCTOPUS_API_KEY` | The API key used to access Octopus Deploy. It is strongly recommended that this value retrieved from a GitHub secret.                                |
| `OCTOPUS_SPACE`   | The Name of a space within which this command will be executed.                                                                                      |

## 📥 Inputs

| Name               | Description                                                                                                                                                                                                  |
| :----------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server_task_id`   | **Required.** The execution task id to watch/wait for.                                                                                                                                                       |
| `polling_interval` | How frequently, in seconds, to check the status. (Default: 10s)                                                                                                                                              |
| `timeout_after`    | Duration, in seconds, to allow for completion before timing out. (Default: 600s)                                                                                                                             |
| `hide_progress`    | Whether to hide the progress of the task. (Default: false)                                                                                                                                                   |
| `server`           | The instance URL hosting Octopus Deploy (i.e. "https://octopus.example.com/"). The instance URL is required, but you may also use the OCTOPUS_URL environment variable.                                      |
| `api_key`          | The API key used to access Octopus Deploy. An API key is required, but you may also use the OCTOPUS_API_KEY environment variable. It is strongly recommended that this value retrieved from a GitHub secret. |
| `space`            | The name of a space within which this command will be executed. The space name is required, but you may also use the OCTOPUS_SPACE environment variable.                                                     |

## 📤 Outputs

| Name         | Description                                                                                                                                                                                                                                               |
| :----------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `task_state` | The final [TaskState](https://github.com/OctopusDeploy/api-client.ts/blob/main/src/features/serverTasks/taskState.ts) (Canceled, Failed, Success, or TimedOut) returned from Octopus, or undefined if Octopus couldn't be contacted to retrieve the state |

## Developers guide

[Developers Guide](DEVELOPERS_GUIDE.md)

## 🤝 Contributions

Contributions are welcome! :heart: Please read our [Contributing Guide](.github/CONTRIBUTING.md) for information about how to get involved in this project.

## Removing a release

To remove a release from publication:

Delete the release from the [releases](https://github.com/OctopusDeploy/await-task-action/releases) page and delete the corresponding tag from the [tags](https://github.com/OctopusDeploy/await-task-action/tags) page.

To do this in the cli:

v123 represents the release name

```
gh release delete v123
git tag -d v123
git push --delete origin v123
```
