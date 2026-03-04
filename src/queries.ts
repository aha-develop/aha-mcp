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
      referenceNum
      workflowStatus {
        name
      }
      startDate
      dueDate
      release {
        name
        referenceNum
      }
      description {
        markdownBody
      }
    }
  }
`;

export const getRequirementQuery = `
  query GetRequirement($id: ID!) {
    requirement(id: $id) {
      name
      referenceNum
      workflowStatus {
        name
      }
      release {
        name
        referenceNum
      }
      description {
        markdownBody
      }
    }
  }
`;

export const getReleaseQuery = `
  query GetRelease($id: ID!) {
    release(id: $id) {
      name
      referenceNum
      releaseDate
      startOn
      endOn
      developmentStartedOn
      releasedOn
      progress
      parkingLot
      daysToRelease
      workflowStatus {
        name
      }
      owner {
        name
      }
      project {
        name
      }
      featuresCount
      features {
        name
        referenceNum
        workflowStatus {
          name
        }
      }
    }
  }
`;

export const listReleasesQuery = `
  query ListReleases($filters: ReleaseFilters) {
    releases(filters: $filters, per: 50) {
      nodes {
        name
        referenceNum
        releaseDate
        startOn
        endOn
        progress
        parkingLot
        daysToRelease
        workflowStatus {
          name
        }
        owner {
          name
        }
        featuresCount
      }
      totalCount
      isLastPage
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
