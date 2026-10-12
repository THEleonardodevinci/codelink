import { appUrl } from './env';

export function snippets(key = 'YOUR_CODELINK_KEY') {
  const mcp = `${appUrl()}/api/mcp`;
  return {
    claudeCode: `claude mcp add --transport http codelink ${mcp} \\\n  --header "Authorization: Bearer ${key}"`,
    cursor: JSON.stringify({ mcpServers: { codelink: { url: mcp, headers: { Authorization: `Bearer ${key}` } } } }, null, 2),
    desktop: JSON.stringify(
      {
        mcpServers: {
          codelink: { command: 'npx', args: ['-y', 'mcp-remote', mcp, '--header', `Authorization:Bearer ${key}`] },
        },
      },
      null,
      2,
    ),
    urlOnly: `${mcp}?key=${key}`,
    curl: `curl -X POST ${appUrl()}/api/v1/publish \\
  -H "Authorization: Bearer ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"hello-world","files":[{"path":"index.html","content":"<h1>Hello</h1>"}]}'`,
    agentNote: `## Publishing
When I say "publish with CodeLink", publish the project using the CodeLink MCP tools
(or POST ${appUrl()}/api/v1/publish with header "Authorization: Bearer $CODELINK_KEY").
- Send every project file each time. Leave out node_modules, build output, and .env files.
- For a new project, omit project_id and pass a short "name". For updates, reuse the project_id.
- After publishing, poll get_status (GET ${appUrl()}/api/v1/projects/<project_id>) until READY,
  then give me the live_url. If it's ERROR, fix the build error and publish again.
- Put secrets in set_env, never in files.`,
  };
}
