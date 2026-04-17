export interface Description {
  htmlBody: string;
}

export interface AhaWorkflowStatus {
  id: string;
  name: string;
  position: number;
  complete: boolean;
  color: string;
}

export interface Record {
  name: string;
  description: Description;
  workflow_status?: AhaWorkflowStatus | null;
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

export interface AhaFeatureSummary {
  id: string | number;
  reference_num: string;
  name: string;
}

export interface AhaEpicSummary {
  id: string | number;
  reference_num: string;
  name: string;
}

export interface ListFeaturesResponse {
  features: AhaFeatureSummary[];
}

export interface ListEpicsResponse {
  epics: AhaEpicSummary[];
}

export interface AhaProductSummary {
  id: string | number;
  reference_prefix: string;
  name: string;
}

export interface ListProductsResponse {
  products: AhaProductSummary[];
}

export interface AhaReleaseSummary {
  id: string | number;
  name: string;
  reference_num: string;
  release_date: string | null;
}

export interface ListReleasesResponse {
  releases: AhaReleaseSummary[];
}

export interface AhaGoalSummary {
  id: string | number;
  reference_num: string;
  name: string;
}

export interface AhaInitiativeSummary {
  id: string | number;
  reference_num: string;
  name: string;
}

export interface ListGoalsResponse {
  goals: AhaGoalSummary[];
}

export interface ListInitiativesResponse {
  initiatives: AhaInitiativeSummary[];
}

export interface AhaFeatureInReleaseSummary {
  id: string | number;
  reference_num: string;
  name: string;
  workflow_status: { name: string } | null;
  epic: { id: string | number; reference_num: string; name: string } | null;
  assigned_to_user: { name: string } | null;
  url: string;
}

export interface AhaEpicInReleaseSummary {
  id: string | number;
  reference_num: string;
  name: string;
  workflow_status: { name: string } | null;
  features_count: number;
  url: string;
}
