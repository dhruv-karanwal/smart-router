import axios from 'axios';

export interface MapNode {
  id: number;
  lat: number;
  lng: number;
  name?: string;
}

export interface MapEdge {
  u: number;
  v: number;
  weight: number;      // Actual distance in meters
  trafficFactor: number; // 1 = Low, 3 = Med, 6 = Heavy
  pathLatLngs: [number, number][]; // detailed curvature for smooth drawing
}

export interface Hospital {
  id: number;
  lat: number;
  lng: number;
  name: string;
  closestNodeId: number;
}

export interface CityGraph {
  nodes: Map<number, MapNode>;
  adjList: Map<number, MapEdge[]>;
}

// Distance formula
export function haversineDist(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180; // φ, λ in radians
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; 
}

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

export async function fetchCityGraph(centerLat: number, centerLng: number, radiusM: number = 800): Promise<{graph: CityGraph, hospitals: Hospital[]}> {
  // Query 1: Roads
  const waysQuery = `
    [out:json];
    way(around:${radiusM}, ${centerLat}, ${centerLng})[highway~"^(primary|secondary|tertiary|residential|trunk)$"];
    (._;>;);
    out body;
  `;

  // Query 2: Hospitals (expand radius a bit to ensure we catch some)
  const hospQuery = `
    [out:json];
    node(around:${radiusM * 1.5}, ${centerLat}, ${centerLng})["amenity"="hospital"];
    out body;
  `;

  try {
    const [roadRes, hospRes] = await Promise.all([
      axios.post(OVERPASS_URL, 'data=' + encodeURIComponent(waysQuery), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }),
      axios.post(OVERPASS_URL, 'data=' + encodeURIComponent(hospQuery), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    ]);

    const graph: CityGraph = {
      nodes: new Map(),
      adjList: new Map(),
    };

    // 1. Parse Nodes
    for (const el of roadRes.data.elements) {
      if (el.type === 'node') {
        graph.nodes.set(el.id, { id: el.id, lat: el.lat, lng: el.lon });
        graph.adjList.set(el.id, []);
      }
    }

    // 2. Parse Edges (Ways)
    for (const el of roadRes.data.elements) {
      if (el.type === 'way' && el.nodes && el.nodes.length > 1) {
        // Create edges between consecutive nodes in the way
        for (let i = 0; i < el.nodes.length - 1; i++) {
          const uId = el.nodes[i];
          const vId = el.nodes[i+1];
          const u = graph.nodes.get(uId);
          const v = graph.nodes.get(vId);
          if (u && v) {
            const dist = haversineDist(u.lat, u.lng, v.lat, v.lng);
            
            // Assume 2-way for simplicity unless one_way=yes (Ignoring one_way for ambulance priority logic)
            const pathInfo: [number, number][] = [[u.lat, u.lng], [v.lat, v.lng]];

            graph.adjList.get(uId)!.push({ u: uId, v: vId, weight: dist, trafficFactor: 1, pathLatLngs: pathInfo });
            graph.adjList.get(vId)!.push({ u: vId, v: uId, weight: dist, trafficFactor: 1, pathLatLngs: [[v.lat, v.lng], [u.lat, u.lng]] });
          }
        }
      }
    }
    
    // Cleanup isolated nodes to keep memory small
    for (const [id, edges] of Array.from(graph.adjList.entries())) {
       if (edges.length === 0) {
           graph.adjList.delete(id);
           graph.nodes.delete(id);
       }
    }

    // 3. Parse Hospitals
    const hospitals: Hospital[] = [];
    let hId = -1;
    for (const el of hospRes.data.elements) {
      if (el.type === 'node') {
        // Find closest valid routing node to snap to
        let closestNodeId = -1;
        let minD = Infinity;
        for (const [nid, node] of Array.from(graph.nodes.entries())) {
          const d = haversineDist(el.lat, el.lon, node.lat, node.lng);
          if (d < minD) {
            minD = d;
            closestNodeId = nid;
          }
        }
        
        if (closestNodeId !== -1) {
            hospitals.push({
                id: hId--,
                lat: el.lat,
                lng: el.lon,
                name: el.tags?.name || "General Hospital",
                closestNodeId: closestNodeId
            });
        }
      }
    }

    return { graph, hospitals };
  } catch (error) {
    console.warn("Overpass API failed (429/timeout), generating fallback smart-grid.", error);
    
    // Generate a fallback mock grid around the center
    const graph: CityGraph = { nodes: new Map(), adjList: new Map() };
    const hospitals: Hospital[] = [];
    
    // 5x5 grid
    const dim = 5;
    const step = 0.003; // ~300 meters per block
    
    for (let r=0; r<dim; r++) {
        for (let c=0; c<dim; c++) {
            const id = r * dim + c;
            const lat = centerLat + (r - 2) * step;
            const lng = centerLng + (c - 2) * step;
            graph.nodes.set(id, { id, lat, lng });
            graph.adjList.set(id, []);
        }
    }
    
    for (let r=0; r<dim; r++) {
        for (let c=0; c<dim; c++) {
            const uId = r * dim + c;
            const u = graph.nodes.get(uId)!;
            
            // Link right
            if (c < dim - 1) {
                const vId = r * dim + (c + 1);
                const v = graph.nodes.get(vId)!;
                const dist = haversineDist(u.lat, u.lng, v.lat, v.lng);
                graph.adjList.get(uId)!.push({ u: uId, v: vId, weight: dist, trafficFactor: 1, pathLatLngs: [[u.lat, u.lng], [v.lat, v.lng]] });
                graph.adjList.get(vId)!.push({ u: vId, v: uId, weight: dist, trafficFactor: 1, pathLatLngs: [[v.lat, v.lng], [u.lat, u.lng]] });
            }
            // Link down
            if (r < dim - 1) {
                const vId = (r + 1) * dim + c;
                const v = graph.nodes.get(vId)!;
                const dist = haversineDist(u.lat, u.lng, v.lat, v.lng);
                graph.adjList.get(uId)!.push({ u: uId, v: vId, weight: dist, trafficFactor: 1, pathLatLngs: [[u.lat, u.lng], [v.lat, v.lng]] });
                graph.adjList.get(vId)!.push({ u: vId, v: uId, weight: dist, trafficFactor: 1, pathLatLngs: [[v.lat, v.lng], [u.lat, u.lng]] });
            }
        }
    }

    // Two mock hospitals at opposite corners
    hospitals.push({ id: 9001, name: "City General (Mock)", lat: centerLat + 2*step, lng: centerLng + 2*step, closestNodeId: 24 });
    hospitals.push({ id: 9002, name: "Mercy West (Mock)", lat: centerLat - 2*step, lng: centerLng - 2*step, closestNodeId: 0 });

    return { graph, hospitals };
  }
}

// Applies randomized traffic (1, 3, or 6 weight multiplier)
export function shuffleTraffic(graph: CityGraph | null) {
  if (!graph || !graph.adjList) return;
  const multipliers = [1, 1, 1, 1, 3, 3, 6]; // Weighted probability 
  const visitedEdgeIdentifiers = new Set<string>();

  for (const [uId, edges] of Array.from(graph.adjList.entries())) {
      for (const edge of edges) {
          const edgeId = uId < edge.v ? `${uId}-${edge.v}` : `${edge.v}-${uId}`;
          if (!visitedEdgeIdentifiers.has(edgeId)) {
             visitedEdgeIdentifiers.add(edgeId);
             
             // Base chance to have elevated traffic
             let f = 1;
             if (Math.random() > 0.75) {
               f = multipliers[Math.floor(Math.random() * multipliers.length)];
             }
             
             edge.trafficFactor = f;
             // apply same to reverse
             const reverse = graph.adjList.get(edge.v)?.find(e => e.v === uId);
             if (reverse) reverse.trafficFactor = f;
          }
      }
  }
}
