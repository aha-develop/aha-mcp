import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from "graphql-request";
import {
  FEATURE_REF_REGEX,
  REQUIREMENT_REF_REGEX,
  NOTE_REF_REGEX,
  Record as AhaRecord,
  FeatureResponse,
  RequirementResponse,
  PageResponse,
  SearchResponse,
  ListProductsResponse,
  ListReleasesResponse,
  ListFeaturesResponse,
  ListEpicsResponse,
} from "./types.js";
import {
  getFeatureQuery,
  getRequirementQuery,
  getPageQuery,
  searchDocumentsQuery,
} from "./queries.js";

export class Handlers {
  constructor(
    private client: GraphQLClient,
    private ahaDomain: string,
    private ahaApiToken: string
  ) {}

  private async restRequest<T>(
    path: string,
    method: "GET" | "POST" | "PUT",
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`https://${this.ahaDomain}.aha.io${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.ahaApiToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `Aha! REST API request failed (${response.status}): ${errorBody}`
      );
    }

    return (await response.json()) as T;
  }

  private async fetchAllPages<T>(
    path: string,
    collectionKey: string
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const data = await this.restRequest<any>(
        `${path}${separator}page=${page}`,
        "GET"
      );

      const pageItems = (data?.[collectionKey] || []) as T[];
      results.push(...pageItems);

      const pagination = data?.pagination as
        | { total_pages?: number; current_page?: number; next_page?: number }
        | undefined;

      if (!pagination) {
        break;
      }

      if (pagination.next_page) {
        page = pagination.next_page;
        continue;
      }

      if (pagination.total_pages && page < pagination.total_pages) {
        page += 1;
        continue;
      }

      break;
    }

    return results;
  }


  async handleGetRecord(request: any) {
    const { reference } = request.params.arguments as { reference: string };

    if (!reference) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Reference number is required"
      );
    }

    try {
      let result: AhaRecord | undefined;

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

  async handleListProducts() {
    try {
      const products = await this.fetchAllPages<ListProductsResponse["products"][number]>(
        "/api/v1/products",
        "products"
      );

      const summaries = products.map((product) => ({
        id: product.id,
        reference_prefix: product.reference_prefix,
        name: product.name,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list products: ${errorMessage}`
      );
    }
  }

  async handleListReleases(request: any) {
    const { product_id } = request.params.arguments as {
      product_id: string;
    };

    if (!product_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Product/workspace identifier is required"
      );
    }

    try {
      const releases = await this.fetchAllPages<
        ListReleasesResponse["releases"][number]
      >(
        `/api/v1/products/${encodeURIComponent(product_id)}/releases`,
        "releases"
      );

      const summaries = releases.map((release) => ({
        id: release.id,
        name: release.name,
        release_date: release.release_date,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list releases: ${errorMessage}`
      );
    }
  }

  async handleListFeatures(request: any) {
    const { product_id } = request.params.arguments as {
      product_id: string;
    };

    if (!product_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Product/workspace identifier is required"
      );
    }

    try {
      const features = await this.fetchAllPages<
        ListFeaturesResponse["features"][number]
      >(
        `/api/v1/products/${encodeURIComponent(product_id)}/features`,
        "features"
      );

      const summaries = features.map((feature) => ({
        reference_num: feature.reference_num,
        name: feature.name,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list features: ${errorMessage}`
      );
    }
  }

  async handleListEpics(request: any) {
    const { product_id } = request.params.arguments as {
      product_id: string;
    };

    if (!product_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Product/workspace identifier is required"
      );
    }

    try {
      const epics = await this.fetchAllPages<ListEpicsResponse["epics"][number]>(
        `/api/v1/products/${encodeURIComponent(product_id)}/epics`,
        "epics"
      );

      const summaries = epics.map((epic) => ({
        reference_num: epic.reference_num,
        name: epic.name,
      }));

      return {
        content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list epics: ${errorMessage}`
      );
    }
  }

  async handleCreateEpic(request: any) {
    const { product_id, name, release_id, description } =
      request.params.arguments as {
        product_id: string;
        name: string;
        release_id: string;
        description?: string;
      };

    if (!product_id || !name || !release_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "product_id, name, and release_id are required"
      );
    }

    const epicPayload: { [key: string]: unknown } = { name, release: release_id };
    if (description) {
      epicPayload.description = description;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/products/${encodeURIComponent(product_id)}/epics`,
        "POST",
        { epic: epicPayload }
      );

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create epic: ${errorMessage}`
      );
    }
  }

  async handleCreateFeature(request: any) {
    const { name, release_id, epic_id, description } = request.params
      .arguments as {
      name: string;
      release_id: string;
      epic_id?: string;
      description?: string;
    };

    if (!name || !release_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "name and release_id are required"
      );
    }

    const featurePayload: { [key: string]: unknown } = { name, release_id };
    if (epic_id) {
      featurePayload.epic = epic_id;
    }
    if (description) {
      featurePayload.description = description;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/releases/${encodeURIComponent(release_id)}/features`,
        "POST",
        { feature: featurePayload }
      );

      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create feature: ${errorMessage}`
      );
    }
  }

  async handleUpdateFeature(request: any) {
    const { reference_num, name, description } = request.params.arguments as {
      reference_num: string;
      name?: string;
      description?: string;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature reference_num is required"
      );
    }

    if (!name && !description) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one of name or description must be provided"
      );
    }

    if (!FEATURE_REF_REGEX.test(reference_num)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid feature reference number format. Expected DEVELOP-123"
      );
    }

    const featurePayload: { [key: string]: unknown } = {};
    if (name) {
      featurePayload.name = name;
    }
    if (description) {
      featurePayload.description = description;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/features/${encodeURIComponent(reference_num)}`,
        "PUT",
        { feature: featurePayload }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update feature: ${errorMessage}`
      );
    }
  }

  async handleUpdateEpic(request: any) {
    const { reference_num, name, description } = request.params.arguments as {
      reference_num: string;
      name?: string;
      description?: string;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Epic reference_num is required"
      );
    }

    if (!name && !description) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one of name or description must be provided"
      );
    }

    const epicPayload: { [key: string]: unknown } = {};
    if (name) {
      epicPayload.name = name;
    }
    if (description) {
      epicPayload.description = description;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/epics/${encodeURIComponent(reference_num)}`,
        "PUT",
        { epic: epicPayload }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update epic: ${errorMessage}`
      );
    }
  }

}
