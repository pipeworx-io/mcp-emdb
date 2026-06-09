interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * EMDB (EBI Electron Microscopy Data Bank) MCP — keyless.
 *
 * 3D cryo-EM and electron-tomography density maps of proteins, complexes, and
 * viruses. Search maps by keyword and fetch an entry's title, sample, method,
 * and resolution. Complements PDB/AlphaFold (experimental structures).
 *
 * API: https://www.ebi.ac.uk/emdb/api  (no key required)
 */


const BASE = 'https://www.ebi.ac.uk/emdb/api';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_maps',
    description:
      'Search the EBI Electron Microscopy Data Bank (EMDB) for 3D cryo-EM / electron-tomography density maps by free-text keyword (e.g. "ribosome", "spike protein", "apoptosis"). Returns matching maps with EMDB id, title, resolution (Angstrom), and structure-determination method. Keyless. Complements PDB/AlphaFold (which hold atomic/experimental structures).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Free-text search, e.g. "ribosome", "spike protein".' },
        limit: { type: 'number', description: 'Max results (default 15, max 50).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_map',
    description:
      'Get a single EMDB entry by its EMDB id (e.g. "EMD-1080"). Returns a trimmed record: title, sample, structure-determination method, resolution (Angstrom), and release date. EMDB holds 3D electron-microscopy density maps of proteins, complexes, and viruses. Keyless.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'An EMDB id like "EMD-1080".' },
      },
      required: ['id'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_maps':
        return await searchMaps(args);
      case 'get_map':
        return await getMap(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

async function searchMaps(args: Record<string, unknown>): Promise<unknown> {
  const query = reqStr(args, 'query', '"ribosome"');
  let limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.floor(args.limit) : 15;
  if (limit < 1) limit = 1;
  if (limit > 50) limit = 50;

  const url = `${BASE}/search/${encodeURIComponent(query)}?rows=${limit}&fl=${encodeURIComponent(
    'emdb_id,title,resolution,structure_determination_method',
  )}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': UA } });
  if (!res.ok) return { error: `EMDB: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const body = (await res.json()) as unknown;
  // The /search endpoint returns a bare JSON array of full entry docs.
  const docs: Array<Record<string, unknown>> = Array.isArray(body)
    ? (body as Array<Record<string, unknown>>)
    : Array.isArray((body as Record<string, unknown>)?.resultset)
      ? ((body as Record<string, unknown>).resultset as Array<Record<string, unknown>>)
      : [];

  const maps = docs.map((d) => ({
    emdb_id: str(d.emdb_id),
    title: pickTitle(d),
    resolution_angstrom: pickResolution(d),
    method: pickMethod(d),
  }));

  return { count: maps.length, maps };
}

async function getMap(args: Record<string, unknown>): Promise<unknown> {
  const id = reqStr(args, 'id', '"EMD-1080"');
  const res = await fetch(`${BASE}/entry/${encodeURIComponent(id)}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'EMDB entry not found', id };
  if (!res.ok) return { error: `EMDB: ${res.status} ${(await res.text()).slice(0, 200)}` };

  const d = (await res.json()) as Record<string, unknown>;
  const admin = obj(d.admin);
  const keyDates = obj(admin.key_dates);
  return {
    emdb_id: str(d.emdb_id) ?? id,
    title: pickTitle(d),
    sample: pickSample(d),
    method: pickMethod(d),
    resolution_angstrom: pickResolution(d),
    release_date: str(keyDates.map_release) ?? str(keyDates.header_release),
  };
}

// --- field extractors (mapped from confirmed nesting) ---

function pickTitle(d: Record<string, unknown>): string | undefined {
  return str(obj(d.admin).title);
}

function pickSample(d: Record<string, unknown>): string | undefined {
  const sample = obj(d.sample);
  const name = sample.name;
  if (typeof name === 'string') return name;
  return str(obj(name).valueOf_) ?? str(name);
}

function firstStructureDetermination(d: Record<string, unknown>): Record<string, unknown> {
  const sdl = obj(d.structure_determination_list);
  const list = sdl.structure_determination;
  if (Array.isArray(list) && list.length) return obj(list[0]);
  return obj(list);
}

function pickMethod(d: Record<string, unknown>): string | undefined {
  return str(firstStructureDetermination(d).method);
}

function pickResolution(d: Record<string, unknown>): string | undefined {
  const sd = firstStructureDetermination(d);
  const ipList = sd.image_processing;
  const ip = Array.isArray(ipList) && ipList.length ? obj(ipList[0]) : obj(ipList);
  const resolution = obj(ip.final_reconstruction).resolution;
  // resolution = { res_type, units, valueOf_ }
  return str(obj(resolution).valueOf_) ?? (typeof resolution === 'string' ? resolution : undefined);
}

// --- helpers ---

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function str(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  return undefined;
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim())
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  return v;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
