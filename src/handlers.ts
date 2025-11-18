import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from "graphql-request";
import {
  FEATURE_REF_REGEX,
  REQUIREMENT_REF_REGEX,
  NOTE_REF_REGEX,
  Record,
  FeatureResponse,
  RequirementResponse,
  PageResponse,
  SearchResponse,
  ReleasesResponse,
  Release,
  WorkflowStatus,
  CreateFeatureResponse,
  UpdateFeatureResponse,
  AddCommentResponse,
} from "./types.js";
import {
  getFeatureQuery,
  getRequirementQuery,
  getPageQuery,
  searchDocumentsQuery,
  getReleasesQuery,
  createFeatureMutation,
  updateFeatureMutation,
  addFeatureCommentMutation,
  getWorkflowIdQuery,
  getFeaturesQuery,
} from "./queries.js";

export class Handlers {
  constructor(
    private client: GraphQLClient,
    private defaultProductId?: string,
    private apiToken?: string,
    private domain?: string,
    private defaultUserEmail?: string
  ) {}

  async handleGetRecord(request: any) {
    const { reference } = request.params.arguments as { reference: string };

    if (!reference) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Reference number is required"
      );
    }

    try {
      let result: Record | undefined;

      if (FEATURE_REF_REGEX.test(reference)) {
        const data = await this.client.request<FeatureResponse>(
          getFeatureQuery,
          {
            id: reference,
          }
        );
        result = data.feature;
      } else if (REQUIREMENT_REF_REGEX.test(reference)) {
        const data = await this.client.request<RequirementResponse>(
          getRequirementQuery,
          { id: reference }
        );
        result = data.requirement;
      } else {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid reference number format. Expected DEVELOP-123 or ADT-123-1"
        );
      }

      if (!result) {
        return {
          content: [
            {
              type: "text",
              text: `No record found for reference ${reference}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch record: ${errorMessage}`
      );
    }
  }

  async handleGetPage(request: any) {
    const { reference, includeParent = false } = request.params.arguments as {
      reference: string;
      includeParent?: boolean;
    };

    if (!reference) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Reference number is required"
      );
    }

    if (!NOTE_REF_REGEX.test(reference)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid reference number format. Expected ABC-N-213"
      );
    }

    try {
      const data = await this.client.request<PageResponse>(getPageQuery, {
        id: reference,
        includeParent,
      });

      if (!data.page) {
        return {
          content: [
            {
              type: "text",
              text: `No page found for reference ${reference}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.page, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch page: ${errorMessage}`
      );
    }
  }

  async handleSearchDocuments(request: any) {
    const { query, searchableType = "Page" } = request.params.arguments as {
      query: string;
      searchableType?: string;
    };

    if (!query) {
      throw new McpError(ErrorCode.InvalidParams, "Search query is required");
    }

    try {
      const data = await this.client.request<SearchResponse>(
        searchDocumentsQuery,
        {
          query,
          searchableType: [searchableType],
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.searchDocuments, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to search documents: ${errorMessage}`
      );
    }
  }

  async handleGetReleases(request: any) {
    const { productId } = request.params.arguments as {
      productId?: string;
    };

    const finalProductId = productId || this.defaultProductId;

    if (!finalProductId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Product ID is required. Provide it as a parameter or set AHA_PRODUCT_ID environment variable"
      );
    }

    try {
      const allReleases: Release[] = [];
      let currentPage = 1;
      let totalPages = 1;
      let isLastPage = false;

      // Fetch all pages of releases
      do {
        const data: ReleasesResponse = await this.client.request<ReleasesResponse>(
          getReleasesQuery,
          {
            productId: finalProductId,
            page: currentPage,
          }
        );

        allReleases.push(...data.releases.nodes);
        
        // Update pagination info
        totalPages = data.releases.totalPages;
        isLastPage = data.releases.isLastPage;
        currentPage = data.releases.currentPage;

        // Move to next page if not on last page
        if (!isLastPage) {
          currentPage++;
        }
      } while (!isLastPage && currentPage <= totalPages);

      // Sort releases by ID (ascending) which correlates with creation order
      const sortedReleases = [...allReleases].sort((a, b) => {
        const idA = BigInt(a.id);
        const idB = BigInt(b.id);
        return idA < idB ? -1 : idA > idB ? 1 : 0;
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(sortedReleases, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch releases: ${errorMessage}`
      );
    }
  }

  async handleCreateFeature(request: any) {
    const { name, description, releaseId } = request.params.arguments as {
      name: string;
      description: string;
      releaseId: string;
    };

    if (!name) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature name is required"
      );
    }

    if (!description) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature description is required"
      );
    }

    if (!releaseId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Release ID is required"
      );
    }

    try {
      const data = await this.client.request<CreateFeatureResponse>(
        createFeatureMutation,
        {
          name,
          description,
          releaseId,
        }
      );

      if (data.createFeature.errors && data.createFeature.errors.length > 0) {
        const errorMessages = data.createFeature.errors
          .flatMap((e) => e.attributes.flatMap((attr) => attr.messages))
          .join(", ");
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to create feature: ${errorMessages}`
        );
      }

      if (!data.createFeature.feature) {
        throw new McpError(
          ErrorCode.InternalError,
          "Feature creation failed: No feature returned"
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.createFeature.feature, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create feature: ${errorMessage}`
      );
    }
  }

  async handleUpdateFeature(request: any) {
    const {
      reference,
      release,
      assignedToUser,
      assignedToUserEmail,
      workflowStatus,
    } = request.params.arguments as {
      reference: string;
      release?: string;
      assignedToUser?: string;
      assignedToUserEmail?: string;
      workflowStatus?: string;
    };

    if (!reference) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature reference is required"
      );
    }

    if (!FEATURE_REF_REGEX.test(reference)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid feature reference format. Expected DEVELOP-123"
      );
    }

    // Check if we have at least one property to update
    // If defaultUserEmail is set, we can assign to that user even if no explicit assignment is provided
    const hasAssignment = assignedToUser || assignedToUserEmail || this.defaultUserEmail;
    if (!release && !hasAssignment && !workflowStatus) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one property (release, assignedToUser, assignedToUserEmail, or workflowStatus) must be provided"
      );
    }

    try {
      // If email is provided, look up the user ID
      // If no email is provided but defaultUserEmail is set, use that
      const emailToUse = assignedToUserEmail || this.defaultUserEmail;
      let finalAssignedToUser = assignedToUser;
      if (emailToUse && !assignedToUser) {
        finalAssignedToUser = await this.getUserByEmail(emailToUse);
      }

      // If workflowStatus is provided, check if it's a name or ID
      // If it contains non-digit characters, treat it as a name and look up the ID
      let finalWorkflowStatusId = workflowStatus;
      if (workflowStatus && !/^\d+$/.test(workflowStatus)) {
        // It's a name, not an ID - need to look it up
        // First get the feature to find its project ID
        const featureData = await this.client.request<FeatureResponse>(
          getFeatureQuery,
          { id: reference }
        );
        
        if (!featureData.feature || !featureData.feature.project?.id) {
          throw new McpError(
            ErrorCode.InternalError,
            "Could not find project ID for feature"
          );
        }

        // Query workflow statuses using REST API
        const matchingStatus = await this.getWorkflowStatusByName(
          featureData.feature.project.id,
          workflowStatus
        );

        finalWorkflowStatusId = matchingStatus;
      }

      // Build the variables object for the mutation
      // Only include relationship inputs that are actually set
      const variables: any = {
        featureId: reference,
      };

      if (release) {
        variables.release = { id: release };
      }
      
      if (finalAssignedToUser) {
        variables.assignedToUser = { id: finalAssignedToUser };
      }
      
      if (finalWorkflowStatusId) {
        variables.workflowStatus = { id: finalWorkflowStatusId };
      }

      const data = await this.client.request<UpdateFeatureResponse>(
        updateFeatureMutation,
        variables
      );

      if (data.updateFeature.errors && data.updateFeature.errors.length > 0) {
        const errorMessages = data.updateFeature.errors
          .flatMap((e) => e.attributes.flatMap((attr) => attr.messages))
          .join(", ");
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to update feature: ${errorMessages}`
        );
      }

      if (!data.updateFeature.feature) {
        throw new McpError(
          ErrorCode.InternalError,
          "Feature update failed: No feature returned"
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data.updateFeature.feature, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update feature: ${errorMessage}`
      );
    }
  }

  async handleGetWorkflowStatuses(request: any) {
    const { projectId } = request.params.arguments as {
      projectId?: string;
    };

    if (!projectId) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Project ID is required"
      );
    }

    try {
      const statuses = await this.getWorkflowStatuses(projectId);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(statuses, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch workflow statuses: ${errorMessage}`
      );
    }
  }

  async getWorkflowStatuses(projectId: string): Promise<WorkflowStatus[]> {
    if (!this.apiToken || !this.domain) {
      throw new McpError(
        ErrorCode.InternalError,
        "API token and domain are required to query workflow statuses"
      );
    }

    try {
      // First, get the workflow ID from a feature's workflow status
      const workflowIdData = await this.client.request<{
        features: {
          nodes: Array<{
            workflowStatus: {
              workflow: {
                id: string;
              } | null;
            } | null;
          }>;
        };
      }>(getWorkflowIdQuery, {
        projectId: projectId,
      });

      const workflowId = workflowIdData.features?.nodes?.[0]?.workflowStatus?.workflow?.id;
      
      if (workflowId) {
        // Use REST API to get workflow details including all statuses
        // Reference: https://www.aha.io/api/resources/workflows/get_a_specific_workflow
        const url = `https://${this.domain}.aha.io/api/v1/workflows/${workflowId}`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const workflowData = await response.json();
          const workflow = workflowData.workflow || workflowData;
          
          // Extract workflow statuses from the workflow response
          // The API response structure may vary, so we'll try multiple possible fields
          const statuses = workflow.workflow_statuses || workflow.statuses || workflow.workflowStatuses || [];
          
          if (Array.isArray(statuses) && statuses.length > 0) {
            return statuses.map((status: any) => ({
              id: String(status.id || status.workflow_status?.id),
              name: status.name || status.workflow_status?.name,
            })).filter((status: WorkflowStatus) => status.id && status.name);
          }
        }
      }

      // Fallback: Query features to collect unique workflow statuses
      // This is a workaround if the workflow definition isn't accessible
      const statusMap = new Map<string, WorkflowStatus>();
      let currentPage = 1;
      let totalPages = 1;
      let isLastPage = false;

      do {
        const featuresData = await this.client.request<{
          features: {
            nodes: Array<{
              workflowStatus: {
                id: string;
                name: string;
              } | null;
            }>;
            currentPage: number;
            totalPages: number;
            isLastPage: boolean;
          };
        }>(getFeaturesQuery, {
          projectId: projectId,
          page: currentPage,
        });

        if (!featuresData.features?.nodes) {
          break;
        }

        // Extract unique workflow statuses from features
        for (const feature of featuresData.features.nodes) {
          if (feature.workflowStatus) {
            statusMap.set(feature.workflowStatus.id, {
              id: feature.workflowStatus.id,
              name: feature.workflowStatus.name,
            });
          }
        }

        // Update pagination info
        totalPages = featuresData.features.totalPages;
        isLastPage = featuresData.features.isLastPage;
        currentPage = featuresData.features.currentPage;

        // Move to next page if not on last page
        if (!isLastPage) {
          currentPage++;
        }
      } while (!isLastPage && currentPage <= totalPages);

      const statuses = Array.from(statusMap.values());
      
      if (statuses.length === 0) {
        throw new McpError(
          ErrorCode.InternalError,
          "No workflow statuses found for project"
        );
      }

      return statuses;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to query workflow statuses: ${errorMessage}`
      );
    }
  }

  async getWorkflowStatusByName(projectId: string, statusName: string): Promise<string> {
    const statuses = await this.getWorkflowStatuses(projectId);

    if (statuses.length === 0) {
      throw new McpError(
        ErrorCode.InternalError,
        `No workflow statuses found for project ${projectId}`
      );
    }

    // Find the workflow status with matching name (case-insensitive)
    const matchingStatus = statuses.find(
      (status) => status.name.toLowerCase() === statusName.toLowerCase()
    );

    if (!matchingStatus) {
      const availableStatuses = statuses.map((s) => s.name).join(", ");
      throw new McpError(
        ErrorCode.InvalidParams,
        `Workflow status "${statusName}" not found. Available statuses: ${availableStatuses}`
      );
    }

    return matchingStatus.id;
  }

  async getUserByEmail(email: string): Promise<string> {
    if (!this.apiToken || !this.domain) {
      throw new McpError(
        ErrorCode.InternalError,
        "API token and domain are required to query users"
      );
    }

    try {
      const url = `https://${this.domain}.aha.io/api/v1/users?email=${encodeURIComponent(email)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const users = data.users || [];

      if (users.length === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `No user found with email: ${email}`
        );
      }

      if (users.length > 1) {
        throw new McpError(
          ErrorCode.InternalError,
          `Multiple users found with email: ${email}`
        );
      }

      return users[0].id;
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to query user: ${errorMessage}`
      );
    }
  }

  async handleGetUserByEmail(request: any) {
    const { email } = request.params.arguments as { email: string };

    if (!email) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Email address is required"
      );
    }

    try {
      const userId = await this.getUserByEmail(email);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: userId,
                email: email,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get user: ${errorMessage}`
      );
    }
  }

  async handleAddFeatureComment(request: any) {
    const { reference, comment } = request.params.arguments as {
      reference: string;
      comment: string;
    };

    if (!reference) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature reference is required"
      );
    }

    if (!FEATURE_REF_REGEX.test(reference)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid feature reference format. Expected DEVELOP-123"
      );
    }

    if (!comment) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Comment is required"
      );
    }

    try {
      const data = await this.client.request<AddCommentResponse>(
        addFeatureCommentMutation,
        {
          featureId: reference,
          comment,
        }
      );

      if (data.createComment.errors && data.createComment.errors.length > 0) {
        const errorMessages = data.createComment.errors
          .flatMap((e) => 
            e.attributes.flatMap((attr) => attr.messages)
          )
          .join(", ");
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to add comment: ${errorMessages}`
        );
      }

      if (!data.createComment.comment || !data.createComment.comment.commentable) {
        throw new McpError(
          ErrorCode.InternalError,
          "Comment addition failed: No feature returned"
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                feature: data.createComment.comment.commentable,
                message: "Comment added successfully",
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }

      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("API Error:", errorMessage);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add comment: ${errorMessage}`
      );
    }
  }
}
