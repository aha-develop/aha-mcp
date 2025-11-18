export interface Description {
  htmlBody: string;
}

export interface Record {
  name: string;
  description: Description;
  project?: {
    id: string;
  };
  release?: {
    id: string;
    name: string;
  };
  workflowStatus?: {
    id: string;
    name: string;
  };
}

export interface FeatureResponse {
  feature: Record;
}

export interface RequirementResponse {
  requirement: Record;
}

export interface PageResponse {
  page: {
    name: string;
    description: Description;
    children: Array<{
      name: string;
      referenceNum: string;
    }>;
    parent?: {
      name: string;
      referenceNum: string;
    };
  };
}

// Regular expressions for validating reference numbers
export const FEATURE_REF_REGEX = /^([A-Z][A-Z0-9]*)-(\d+)$/;
export const REQUIREMENT_REF_REGEX = /^([A-Z][A-Z0-9]*)-(\d+)-(\d+)$/;
export const NOTE_REF_REGEX = /^([A-Z][A-Z0-9]*)-N-(\d+)$/;

export interface SearchNode {
  name: string | null;
  url: string;
  searchableId: string;
  searchableType: string;
}

export interface SearchResponse {
  searchDocuments: {
    nodes: SearchNode[];
    currentPage: number;
    totalCount: number;
    totalPages: number;
    isLastPage: boolean;
  };
}

export interface Release {
  id: string;
  name: string;
  releaseDate: string | null;
  referenceNum: string;
  createdAt?: string;
}

export interface WorkflowStatus {
  id: string;
  name: string;
}

export interface ReleasesResponse {
  releases: {
    nodes: Release[];
    currentPage: number;
    totalCount: number;
    totalPages: number;
    isLastPage: boolean;
  };
}

export interface GraphQLError {
  message: string;
  attribute?: string;
}

export interface CreateFeatureResponse {
  createFeature: {
    feature: {
      id: string;
      name: string;
      referenceNum: string;
      description: {
        markdownBody: string;
      };
    } | null;
    errors: {
      attributes: {
        messages: string[];
      }[];
    }[];
  };
}

export interface UpdateFeatureResponse {
  updateFeature: {
    feature: {
      id: string;
      name: string;
      referenceNum: string;
      release: {
        id: string;
        name: string;
      } | null;
      assignedToUser: {
        id: string;
        name: string;
      } | null;
      workflowStatus: {
        id: string;
        name: string;
      } | null;
    } | null;
    errors: {
      attributes: {
        messages: string[];
      }[];
    }[];
  };
}

export interface AddCommentResponse {
  createComment: {
    comment: {
      id: string;
      commentable: {
        id: string;
        referenceNum: string;
      } | null;
    } | null;
    errors: {
      attributes: {
        messages: string[];
      }[];
    }[];
  };
}
