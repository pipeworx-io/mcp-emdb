# mcp-emdb

EMDB (EBI Electron Microscopy Data Bank) MCP — keyless.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_maps` | Search the EBI Electron Microscopy Data Bank (EMDB) for 3D cryo-EM / electron-tomography density maps by free-text keyword (e.g. "ribosome", "spike protein", "apoptosis"). Returns matching maps with EMDB id, title, resolution (Angstrom), and structure-determination method. Keyless. Complements PDB/AlphaFold (which hold atomic/experimental structures). |
| `get_map` | Get a single EMDB entry by its EMDB id (e.g. "EMD-1080"). Returns a trimmed record: title, sample, structure-determination method, resolution (Angstrom), and release date. EMDB holds 3D electron-microscopy density maps of proteins, complexes, and viruses. Keyless. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "emdb": {
      "url": "https://gateway.pipeworx.io/emdb/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Emdb data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
