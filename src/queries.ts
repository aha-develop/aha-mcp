export const getPageQuery = `
  query GetPage($id: ID!, $includeParent: Boolean!) {
    page(id: $id) {
      name
      description {
        markdownBody
      }
      children {
        name
        referenceNum
      }
      parent @include(if: $includeParent) {
        name
        referenceNum
      }
    }
  }
`;

export const getFeatureQuery = `
  query GetFeature($id: ID!) {
    feature(id: $id) {
      name
      description {
        markdownBody
      }
      project {
        id
      }
      release {
        id
        name
      }
      workflowStatus {
        id
        name
      }
    }
  }
`;

export const getRequirementQuery = `
  query GetRequirement($id: ID!) {
    requirement(id: $id) {
      name
      description {
        markdownBody
      }
    }
  }
`;

export const searchDocumentsQuery = `
  query SearchDocuments($query: String!, $searchableType: [String!]!) {
    searchDocuments(filters: {query: $query, searchableType: $searchableType}) {
      nodes {
        name
        url
        searchableId
        searchableType
      }
      currentPage
      totalCount
      totalPages
      isLastPage
    }
  }
`;

export const getReleasesQuery = `
  query GetReleases($productId: ID!, $page: Int) {
    releases(filters: {projectId: $productId}, page: $page) {
      nodes {
        id
        name
        releaseDate
        referenceNum
        createdAt
      }
      currentPage
      totalCount
      totalPages
      isLastPage
    }
  }
`;

export const createFeatureMutation = `
  mutation CreateFeature($name: String!, $description: String!, $releaseId: ID!) {
    createFeature(attributes: {
      name: $name
      description: $description
      release: { id: $releaseId }
    }) {
      feature {
        id
        name
        referenceNum
        description {
          markdownBody
        }
      }
      errors {
        attributes {
          messages
        }
      }
    }
  }
`;

export const updateFeatureMutation = `
  mutation UpdateFeature($featureId: ID!, $release: ReleaseRelationshipInput, $assignedToUser: UserRelationshipInput, $workflowStatus: WorkflowStatusRelationshipInput) {
    updateFeature(id: $featureId, attributes: {
      release: $release
      assignedToUser: $assignedToUser
      workflowStatus: $workflowStatus
    }) {
      feature {
        id
        name
        referenceNum
        release {
          id
          name
        }
        assignedToUser {
          id
          name
        }
        workflowStatus {
          id
          name
        }
      }
      errors {
        attributes {
          messages
        }
      }
    }
  }
`;

export const getWorkflowIdQuery = `
  query GetWorkflowId($projectId: ID!) {
    features(filters: {projectId: $projectId}, page: 1) {
      nodes {
        workflowStatus {
          workflow {
            id
          }
        }
      }
    }
  }
`;

export const addFeatureCommentMutation = `
  mutation AddFeatureComment($featureId: ID!, $comment: String!) {
    createComment(attributes: {
      commentable: { id: $featureId, typename: Feature }
      body: $comment
    }) {
      comment {
        id
        commentable {
          ... on Feature {
            id
            referenceNum
          }
        }
      }
      errors {
        attributes {
          messages
        }
      }
    }
  }
`;

export const getFeaturesQuery = `
  query GetFeatures($projectId: ID!, $page: Int) {
    features(filters: {projectId: $projectId}, page: $page) {
      nodes {
        workflowStatus {
          id
          name
        }
      }
      currentPage
      totalPages
      isLastPage
    }
  }
`;
