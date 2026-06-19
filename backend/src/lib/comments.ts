export interface FlatComment {
  id: number;
  content: string;
  postId: number;
  username: string;
  email: string | null;
  websiteUrl: string | null;
  parentId: number | null;
  createdAt: Date;
  depth: number;
  path: number[];
}

export interface ThreadedComment extends FlatComment {
  children: ThreadedComment[];
}

export function buildCommentTree(flatList: FlatComment[]): ThreadedComment[] {
  const roots: ThreadedComment[] = [];
  const idToNode = new Map<number, ThreadedComment>();

  for (const flat of flatList) {
    const node: ThreadedComment = { ...flat, children: [] };
    idToNode.set(node.id, node);

    if (flat.parentId === null) {
      roots.push(node);
    } else {
      const parent = idToNode.get(flat.parentId);
      if (parent) {
        parent.children = [...parent.children, node];
      } else {
        roots.push(node);
      }
    }
  }

  return roots;
}
