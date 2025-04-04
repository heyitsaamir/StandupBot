# Technical Context: OneNote Integration

## Technologies

### Core Dependencies

- Microsoft Graph API
- @microsoft/graph-client - For OneNote page interactions
- Teams Bot Framework

### Key Endpoints

- OneNote Page Update: `PATCH /groups/{id}/onenote/pages/{id}/content`

## Integration Architecture

```mermaid
flowchart TD
    Bot[Teams Bot] --> Service[OneNote Service]
    Service --> Graph[Graph API]
    Graph --> OneNote[OneNote Page]

    subgraph OneNote Service
        Auth[Authentication]
        PageOps[Page Operations]
        Format[Content Formatting]
    end
```

## Authentication Requirements

1. Azure AD Application registration
2. Required permissions:
   - Notes.Create
   - Notes.ReadWrite
   - Notes.ReadWrite.All

## Data Flow

```mermaid
sequenceDiagram
    participant Bot
    participant Service as OneNote Service
    participant Graph as Graph API
    participant Page as OneNote Page

    Bot->>Service: Submit Standup Summary
    Service->>Graph: Get Page Content
    Graph-->>Service: Return Current Content
    Service->>Service: Format New Content
    Service->>Graph: Update Page
    Graph-->>Service: Success Response
    Service-->>Bot: Update Complete
```

## Content Structure

- Each OneNote page will use HTML for formatting
- New standups will be prepended to maintain chronological order
- Format:

```html
<div data-standup-date="YYYY-MM-DD">
  <h1>Standup Summary - [Date]</h1>
  <div class="participants">[List of participants]</div>
  <div class="updates">[Individual updates]</div>
  <div class="parking-lot">[Parking lot items if any]</div>
</div>
```

## Error Handling Strategy

- Retry mechanism for transient failures
- Fallback to local storage if OneNote is unavailable
- Error reporting through bot interface
