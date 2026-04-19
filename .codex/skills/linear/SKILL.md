---
name: linear
description: |
  Use Symphony's `linear_graphql` client tool for raw Linear GraphQL
  operations such as comment editing and status updates.
---

# Linear GraphQL

Use this skill for raw Linear GraphQL work during Symphony app-server sessions.

## Primary tool

Use the `linear_graphql` client tool exposed by Symphony's app-server session.
It reuses Symphony's configured Linear auth for the session.

Tool input:

```json
{
  "query": "query or mutation document",
  "variables": {
    "optional": "graphql variables object"
  }
}
```

## Operating rules

- Send one GraphQL operation per tool call.
- Treat a top-level `errors` array as a failed GraphQL operation even if the tool call itself completed.
- Keep queries and mutations narrowly scoped.

## Common workflows

### Query an issue by key

```graphql
query IssueByKey($key: String!) {
  issue(id: $key) {
    id
    identifier
    title
    url
    description
    branchName
    state {
      id
      name
      type
    }
    project {
      id
      name
    }
  }
}
```

### Query a team's workflow states

```graphql
query IssueTeamStates($id: String!) {
  issue(id: $id) {
    id
    team {
      id
      key
      name
      states {
        nodes {
          id
          name
          type
        }
      }
    }
  }
}
```

### Update an issue state

```graphql
mutation MoveIssue($id: String!, $stateId: String!) {
  issueUpdate(id: $id, input: { stateId: $stateId }) {
    success
    issue {
      id
      identifier
      state {
        id
        name
      }
    }
  }
}
```

### Update an existing comment

```graphql
mutation UpdateComment($id: String!, $body: String!) {
  commentUpdate(id: $id, input: { body: $body }) {
    success
    comment {
      id
      body
    }
  }
}
```

