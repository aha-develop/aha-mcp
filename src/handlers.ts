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
} from "./types.js";
import {
  getFeatureQuery,
  getRequirementQuery,
  getPageQuery,
  searchDocumentsQuery,
} from "./queries.js";

export class Handlers {
  constructor(private client: GraphQLClient) {}

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

      if (REQUIREMENT_REF_REGEX.test(reference)) {
        const data = await this.client.request<RequirementResponse>(
          getRequirementQuery,
          { id: reference }
        );
        result = data.requirement;
      } else if (FEATURE_REF_REGEX.test(reference)) {
        const data = await this.client.request<FeatureResponse>(
          getFeatureQuery,
          {
            id: reference,
          }
        );
        result = data.feature;
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
}
