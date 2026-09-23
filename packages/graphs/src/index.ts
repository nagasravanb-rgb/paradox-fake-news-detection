import type { KnowledgeGraph } from "@paradox/shared";

export function serializeGraph(graph: KnowledgeGraph): KnowledgeGraph {
  return {
    id: graph.id,
    graphType: graph.graphType,
    nodes: graph.nodes.filter((n) => n.id && n.label),
    edges: graph.edges.filter((e) => graph.nodes.some((n) => n.id === e.from) && graph.nodes.some((n) => n.id === e.to)),
  };
}
