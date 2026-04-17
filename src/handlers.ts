import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { GraphQLClient } from "graphql-request";
import {
  FEATURE_REF_REGEX,
  REQUIREMENT_REF_REGEX,
  NOTE_REF_REGEX,
  PageResponse,
  SearchResponse,
  ListProductsResponse,
  AhaReleaseSummary,
  AhaFeatureSummary,
  AhaEpicSummary,
  AhaGoalSummary,
  AhaInitiativeSummary,
  AhaFeatureInReleaseSummary,
  AhaEpicInReleaseSummary,
} from "./types.js";
import {
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
    method: "GET" | "POST" | "PUT" | "DELETE",
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

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // Maps user-facing record type to the URL path segment used in the record_links API.
  // Epics are "master_features" in the Aha! REST API's record_links paths.
  private static readonly RECORD_TYPE_API_PATH: Record<string, string> = {
    feature: "features",
    epic: "master_features",
    release: "releases",
    idea: "ideas",
    initiative: "initiatives",
    page: "pages",
    goal: "goals",
    release_phase: "release_phases",
    requirement: "requirements",
  };

  // Maps user-facing record type to the path used for GET resolution.
  // Epics are resolved via /api/v1/epics/:ref (consistent with existing handlers).
  private static readonly RECORD_TYPE_FETCH_PATH: Record<string, string> = {
    feature: "features",
    epic: "epics",
    release: "releases",
    idea: "ideas",
    initiative: "initiatives",
    page: "pages",
    goal: "goals",
    release_phase: "release_phases",
    requirement: "requirements",
  };

  // Maps user-facing record type to the record_type string in a POST /record_links body.
  private static readonly RECORD_TYPE_BODY: Record<string, string> = {
    feature: "feature",
    epic: "epic",
    release: "release",
    idea: "idea",
    initiative: "initiative",
    page: "page",
    goal: "goal",
    release_phase: "release_phase",
    requirement: "requirement",
  };

  // Ownership hierarchy: higher index = higher order (goal is highest).
  // Used for hierarchy inference when link_type is omitted.
  private static readonly HIERARCHY = [
    "requirement",
    "feature",
    "epic",
    "initiative",
    "goal",
  ] as const;

  private static readonly LINK_TYPE_LABELS: Record<number, string> = {
    10: "Relates to",
    20: "Depends on",
    30: "Duplicated by",
    40: "Contained by",
    50: "Impacted by",
    60: "Blocked by",
    80: "Research for",
  };

  // Resolves a user-facing record type + reference number to the full raw API record object.
  // The returned object always includes an `id` field.
  private async resolveRecord(type: string, referenceNum: string): Promise<any> {
    const fetchPath = Handlers.RECORD_TYPE_FETCH_PATH[type];
    if (!fetchPath) {
      throw new McpError(ErrorCode.InvalidParams, `Unsupported record type: ${type}`);
    }
    try {
      const data = await this.restRequest<any>(
        `/api/v1/${fetchPath}/${encodeURIComponent(referenceNum)}?fields=*`,
        "GET"
      );
      const record = data[type];
      if (!record) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Record not found: ${type} ${referenceNum}`
        );
      }
      return record;
    } catch (error) {
      if (error instanceof McpError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("(404)") || msg.includes("404")) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Record not found: ${type} ${referenceNum}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to resolve ${type} ${referenceNum}: ${msg}`
      );
    }
  }

  private async fetchAllPages<T>(
    path: string,
    key: string
  ): Promise<T[]> {
    const allItems: T[] = [];
    let page = 1;

    while (true) {
      const separator = path.includes("?") ? "&" : "?";
      const pagedPath = `${path}${separator}page=${page}`;
      const data = await this.restRequest<any>(pagedPath, "GET");
      const pageItems = Array.isArray(data?.[key]) ? data[key] : [];
      allItems.push(...pageItems);

      const pagination = data?.pagination;
      if (
        pagination &&
        typeof pagination.current_page === "number" &&
        typeof pagination.total_pages === "number"
      ) {
        if (pagination.current_page >= pagination.total_pages) {
          break;
        }
      } else if (pageItems.length === 0) {
        break;
      }

      page += 1;
    }

    return allItems;
  }

  async handleGetRecord(request: any) {
    const { reference_num } = request.params.arguments as { reference_num: string };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Reference number is required"
      );
    }

    try {
      let data: any;
      let record: any;

      if (FEATURE_REF_REGEX.test(reference_num)) {
        data = await this.restRequest<any>(
          `/api/v1/features/${encodeURIComponent(reference_num)}?fields=*,workflow_status`,
          "GET"
        );
        record = data.feature;
      } else if (REQUIREMENT_REF_REGEX.test(reference_num)) {
        data = await this.restRequest<any>(
          `/api/v1/requirements/${encodeURIComponent(reference_num)}?fields=*,workflow_status`,
          "GET"
        );
        record = data.requirement;
      } else {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Invalid reference number format. Expected DEVELOP-123 or ADT-123-1"
        );
      }

      if (!record) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No record found for reference ${reference_num}`,
            },
          ],
        };
      }

      const result: { [key: string]: unknown } = {
        id: record.id,
        reference_num: record.reference_num,
        name: record.name,
        description: record.description?.body ?? null,
      };

      if (record.workflow_status) {
        result.workflow_status = {
          id: String(record.workflow_status.id),
          name: record.workflow_status.name,
          position: record.workflow_status.position,
          complete: record.workflow_status.complete === true,
          color: record.workflow_status.color ?? "",
        };
      }

      if (record.epic) {
        result.epic = {
          id: record.epic.id,
          reference_num: record.epic.reference_num,
          name: record.epic.name,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
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
    const { reference_num, includeParent = false } = request.params.arguments as {
      reference_num: string;
      includeParent?: boolean;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Reference number is required"
      );
    }

    if (!NOTE_REF_REGEX.test(reference_num)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid reference number format. Expected ABC-N-213"
      );
    }

    try {
      const data = await this.client.request<PageResponse>(getPageQuery, {
        id: reference_num,
        includeParent,
      });

      if (!data.page) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No page found for reference ${reference_num}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
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
            type: "text" as const,
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
      const data = await this.restRequest<ListProductsResponse>(
        "/api/v1/products",
        "GET"
      );

      const summaries = (data.products || []).map((product) => ({
        id: product.id,
        reference_prefix: product.reference_prefix,
        name: product.name,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
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
      const releases = await this.fetchAllPages<AhaReleaseSummary>(
        `/api/v1/products/${encodeURIComponent(product_id)}/releases`,
        "releases"
      );

      const summaries = releases.map((release) => ({
        id: release.id,
        reference_num: release.reference_num,
        name: release.name,
        release_date: release.release_date,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
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
      const features = await this.fetchAllPages<AhaFeatureSummary>(
        `/api/v1/products/${encodeURIComponent(product_id)}/features`,
        "features"
      );

      const summaries = features.map((feature) => ({
        id: feature.id,
        reference_num: feature.reference_num,
        name: feature.name,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
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
      const epics = await this.fetchAllPages<AhaEpicSummary>(
        `/api/v1/products/${encodeURIComponent(product_id)}/epics`,
        "epics"
      );

      const summaries = epics.map((epic) => ({
        id: epic.id,
        reference_num: epic.reference_num,
        name: epic.name,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
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

    const epicPayload: { [key: string]: unknown } = { name, release_id };
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
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
    const { product_id, name, release_id, epic_id, description } =
      request.params.arguments as {
        product_id: string;
        name: string;
        release_id: string;
        epic_id?: string;
        description?: string;
      };

    if (!product_id || !name || !release_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "product_id, name, and release_id are required"
      );
    }

    const featurePayload: { [key: string]: unknown } = { name, release_id };
    if (epic_id) {
      featurePayload.epic_id = epic_id;
    }
    if (description) {
      featurePayload.description = description;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/products/${encodeURIComponent(product_id)}/features`,
        "POST",
        { feature: featurePayload }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
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
    const { reference_num, name, description, epic_id, initiative_reference_num, goal_ids, workflow_status } =
      request.params.arguments as {
        reference_num: string;
        name?: string;
        description?: string;
        epic_id?: string;
        initiative_reference_num?: string;
        goal_ids?: string[];
        workflow_status?: string;
      };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Feature reference_num is required"
      );
    }

    if (
      name === undefined &&
      description === undefined &&
      epic_id === undefined &&
      initiative_reference_num === undefined &&
      goal_ids === undefined &&
      workflow_status === undefined
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one of name, description, epic_id, initiative_reference_num, goal_ids, or workflow_status must be provided"
      );
    }

    if (!FEATURE_REF_REGEX.test(reference_num)) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid feature reference number format. Expected DEVELOP-123"
      );
    }

    const featurePayload: { [key: string]: unknown } = {};
    if (name !== undefined) {
      featurePayload.name = name;
    }
    if (description !== undefined) {
      featurePayload.description = description;
    }
    if (epic_id !== undefined) {
      featurePayload.epic = epic_id;
    }
    if (initiative_reference_num !== undefined) {
      featurePayload.initiative = initiative_reference_num;
    }
    if (goal_ids !== undefined) {
      featurePayload.goals = goal_ids;
    }
    if (workflow_status !== undefined) {
      featurePayload.workflow_status = workflow_status;
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
            type: "text" as const,
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
    const { reference_num, name, description, initiative_reference_num, goal_ids, workflow_status } =
      request.params.arguments as {
        reference_num: string;
        name?: string;
        description?: string;
        initiative_reference_num?: string;
        goal_ids?: string[];
        workflow_status?: string;
      };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Epic reference_num is required"
      );
    }

    if (
      name === undefined &&
      description === undefined &&
      initiative_reference_num === undefined &&
      goal_ids === undefined &&
      workflow_status === undefined
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one of name, description, initiative_reference_num, goal_ids, or workflow_status must be provided"
      );
    }

    const epicPayload: { [key: string]: unknown } = {};
    if (name !== undefined) {
      epicPayload.name = name;
    }
    if (description !== undefined) {
      epicPayload.description = description;
    }
    if (initiative_reference_num !== undefined) {
      epicPayload.initiative = initiative_reference_num;
    }
    if (goal_ids !== undefined) {
      epicPayload.goals = goal_ids;
    }
    if (workflow_status !== undefined) {
      epicPayload.workflow_status = { name: workflow_status };
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
            type: "text" as const,
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

  async handleGetEpic(request: any) {
    const { reference_num } = request.params.arguments as {
      reference_num: string;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Epic reference_num is required"
      );
    }

    try {
      const result = await this.restRequest(
        `/api/v1/epics/${encodeURIComponent(reference_num)}`,
        "GET"
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get epic: ${errorMessage}`
      );
    }
  }

  async handleGetInitiative(request: any) {
    const { reference_num } = request.params.arguments as {
      reference_num: string;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Initiative reference_num is required"
      );
    }

    try {
      const result = await this.restRequest(
        `/api/v1/initiatives/${encodeURIComponent(reference_num)}`,
        "GET"
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get initiative: ${errorMessage}`
      );
    }
  }

  async handleGetGoal(request: any) {
    const { reference_num } = request.params.arguments as {
      reference_num: string;
    };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Goal reference_num is required"
      );
    }

    try {
      const result = await this.restRequest(
        `/api/v1/goals/${encodeURIComponent(reference_num)}`,
        "GET"
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get goal: ${errorMessage}`
      );
    }
  }

  async handleListInitiatives(request: any) {
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
      const initiatives = await this.fetchAllPages<AhaInitiativeSummary>(
        `/api/v1/products/${encodeURIComponent(product_id)}/initiatives`,
        "initiatives"
      );

      const summaries = initiatives.map((initiative) => ({
        id: initiative.id,
        reference_num: initiative.reference_num,
        name: initiative.name,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list initiatives: ${errorMessage}`
      );
    }
  }

  async handleListGoals(request: any) {
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
      const goals = await this.fetchAllPages<AhaGoalSummary>(
        `/api/v1/products/${encodeURIComponent(product_id)}/goals`,
        "goals"
      );

      const summaries = goals.map((goal) => ({
        id: goal.id,
        reference_num: goal.reference_num,
        name: goal.name,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list goals: ${errorMessage}`
      );
    }
  }

  async handleGetRelease(request: any) {
    const { release_reference_num } = request.params.arguments as {
      release_reference_num: string;
    };

    if (!release_reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Release reference number is required"
      );
    }

    try {
      const data = await this.restRequest<any>(
        `/api/v1/releases/${encodeURIComponent(release_reference_num)}`,
        "GET"
      );
      const r = data.release;

      const result: Record<string, unknown> = {
        id: r.id,
        reference_num: r.reference_num,
        name: r.name,
        release_date: r.release_date,
        development_started_on: r.development_started_on ?? null,
        released_on: r.released_on ?? null,
        url: r.url,
      };

      if (Array.isArray(r.release_phases) && r.release_phases.length > 0) {
        result.release_phases = r.release_phases.map((p: any) => ({
          id: p.id,
          name: p.name,
          start_on: p.start_on,
          end_on: p.end_on,
        }));
      }

      if (Array.isArray(r.initiatives)) {
        result.initiatives = r.initiatives.map((i: any) => ({
          id: i.id,
          reference_num: i.reference_num,
          name: i.name,
        }));
      }

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get release: ${errorMessage}`
      );
    }
  }

  async handleListFeaturesInRelease(request: any) {
    const { release_reference_num } = request.params.arguments as {
      release_reference_num: string;
    };

    if (!release_reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Release reference number is required"
      );
    }

    try {
      const features = await this.fetchAllPages<AhaFeatureInReleaseSummary>(
        `/api/v1/releases/${encodeURIComponent(release_reference_num)}/features?per_page=200`,
        "features"
      );

      const summaries = features.map((f) => ({
        id: f.id,
        reference_num: f.reference_num,
        name: f.name,
        workflow_status: f.workflow_status
          ? { name: f.workflow_status.name }
          : null,
        epic: f.epic
          ? { id: f.epic.id, reference_num: f.epic.reference_num, name: f.epic.name }
          : null,
        assigned_to_user: f.assigned_to_user
          ? { name: f.assigned_to_user.name }
          : null,
        url: f.url,
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { total_count: summaries.length, features: summaries },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list features in release: ${errorMessage}`
      );
    }
  }

  async handleListEpicsInRelease(request: any) {
    const { release_reference_num } = request.params.arguments as {
      release_reference_num: string;
    };

    if (!release_reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Release reference number is required"
      );
    }

    try {
      const epics = await this.fetchAllPages<AhaEpicInReleaseSummary>(
        `/api/v1/releases/${encodeURIComponent(release_reference_num)}/master_features`,
        "master_features"
      );

      const summaries = epics.map((e) => ({
        id: e.id,
        reference_num: e.reference_num,
        name: e.name,
        workflow_status: e.workflow_status
          ? { name: e.workflow_status.name }
          : null,
        features_count: e.features_count,
        url: e.url,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(summaries, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list epics in release: ${errorMessage}`
      );
    }
  }

  async handleListWorkflowStatuses(request: any) {
    const { workspace_id, record_type } = request.params.arguments as {
      workspace_id: string;
      record_type: string;
    };

    if (!workspace_id) {
      throw new McpError(ErrorCode.InvalidParams, "workspace_id is required");
    }
    if (record_type !== "feature" && record_type !== "epic") {
      throw new McpError(
        ErrorCode.InvalidParams,
        'record_type must be "feature" or "epic"'
      );
    }

    // Extract product key from any reference-style input (e.g. "STU-97" → "STU", "STU-E-5" → "STU")
    const productKey = workspace_id.includes("-")
      ? workspace_id.split("-")[0]
      : workspace_id;

    // Step 1: list all workflows for the workspace
    let workflowsData: any;
    try {
      workflowsData = await this.restRequest<any>(
        `/api/v1/products/${encodeURIComponent(productKey)}/workflows`,
        "GET"
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const statusMatch = msg.match(/\((\d+)\)/);
      const statusCode = statusMatch ? statusMatch[1] : "unknown";
      throw new McpError(
        ErrorCode.InternalError,
        `list_workflow_statuses failed for workspace "${productKey}": API returned ${statusCode}. Check that the workspace key is correct.`
      );
    }

    const workflows: any[] = Array.isArray(workflowsData?.workflows)
      ? workflowsData.workflows
      : [];

    if (workflows.length === 0) {
      throw new McpError(
        ErrorCode.InternalError,
        `list_workflow_statuses failed for workspace "${productKey}": No workflows found. Check that the workspace key is correct.`
      );
    }

    // Filter by record_type using the workflow's kind field.
    // Aha! kinds: "Feature" for features, "MasterFeature" for epics.
    // Fall back to all workflows if kind is absent from the response.
    const kindFilter = record_type === "feature" ? "feature" : "master";
    const filteredWorkflows = workflows.filter((wf) => {
      const kind: string = (wf.kind ?? "").toLowerCase();
      return kind === "" || kind.includes(kindFilter);
    });
    const workflowsToProcess = filteredWorkflows.length > 0 ? filteredWorkflows : workflows;

    // Step 2: for each workflow, collect statuses. The list endpoint may already
    // include workflow_statuses inline; if not, fetch the workflow detail individually.
    const results: Array<{
      workflow_name: string;
      statuses: Array<{
        id: string;
        name: string;
        position: number;
        complete: boolean;
        color: string;
      }>;
    }> = [];

    for (const wf of workflowsToProcess) {
      let rawStatuses: any[] = Array.isArray(wf.workflow_statuses)
        ? wf.workflow_statuses
        : [];

      if (rawStatuses.length === 0 && wf.id) {
        try {
          const detail = await this.restRequest<any>(
            `/api/v1/workflows/${encodeURIComponent(wf.id)}?fields=*`,
            "GET"
          );
          const detailWf = detail?.workflow ?? detail;
          rawStatuses = Array.isArray(detailWf?.workflow_statuses)
            ? detailWf.workflow_statuses
            : [];
        } catch {
          // If the detail fetch fails, include the workflow with an empty statuses list
        }
      }

      results.push({
        workflow_name: wf.name,
        statuses: rawStatuses.map((s: any) => ({
          id: String(s.id),
          name: s.name,
          position: typeof s.position === "number" ? s.position : 0,
          complete: s.complete === true,
          color: s.color ?? "",
        })),
      });
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(results, null, 2),
        },
      ],
    };
  }

  async handleCreateRecordLink(request: any) {
    const {
      source_record_type,
      source_reference_num,
      target_record_type,
      target_reference_num,
      link_type: inputLinkType,
    } = request.params.arguments as {
      source_record_type: string;
      source_reference_num: string;
      target_record_type: string;
      target_reference_num: string;
      link_type?: number;
    };

    if (
      !source_record_type ||
      !source_reference_num ||
      !target_record_type ||
      !target_reference_num
    ) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "source_record_type, source_reference_num, target_record_type, and target_reference_num are required"
      );
    }

    const srcType = source_record_type.toLowerCase();
    const tgtType = target_record_type.toLowerCase();

    try {
      // --- Ownership routing: Feature/Epic → Goal (always use field setter) ---
      if (
        (srcType === "feature" || srcType === "epic") &&
        tgtType === "goal"
      ) {
        const goalRecord = await this.resolveRecord("goal", target_reference_num);
        const goalId = String(goalRecord.id);

        const sourceRecord = await this.resolveRecord(srcType, source_reference_num);
        const existingGoals: any[] = Array.isArray(sourceRecord.goals)
          ? sourceRecord.goals
          : [];
        const existingGoalIds = existingGoals.map((g: any) => String(g.id));

        if (!existingGoalIds.includes(goalId)) {
          const newGoalIds = [...existingGoalIds, goalId];
          if (srcType === "feature") {
            await this.restRequest(
              `/api/v1/features/${encodeURIComponent(source_reference_num)}`,
              "PUT",
              { feature: { goals: newGoalIds } }
            );
          } else {
            await this.restRequest(
              `/api/v1/epics/${encodeURIComponent(source_reference_num)}`,
              "PUT",
              { epic: { goals: newGoalIds } }
            );
          }
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  mechanism: "field_setter",
                  source: source_reference_num,
                  target: target_reference_num,
                  relationship: "Belongs to goal",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // --- Ownership routing: Feature/Epic → Initiative (field setter when no link_type) ---
      if (
        (srcType === "feature" || srcType === "epic") &&
        tgtType === "initiative" &&
        inputLinkType === undefined
      ) {
        const sourceRecord = await this.resolveRecord(srcType, source_reference_num);
        const existingInitiative = sourceRecord.initiative;

        if (
          existingInitiative &&
          (existingInitiative.reference_num || existingInitiative.id)
        ) {
          const existingRef =
            existingInitiative.reference_num ?? String(existingInitiative.id);

          // Already linked to the requested initiative — idempotent success
          if (
            existingRef === target_reference_num ||
            String(existingInitiative.id) === target_reference_num
          ) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify(
                    {
                      success: true,
                      mechanism: "ownership_field",
                      source: source_reference_num,
                      target: target_reference_num,
                      note: `${source_reference_num} already belongs to initiative ${existingRef} — no change needed.`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    success: false,
                    action_required: true,
                    message:
                      `${source_reference_num} already belongs to initiative ${existingRef}` +
                      ` ("${existingInitiative.name ?? existingRef}"). ` +
                      `To replace it: call update_${srcType} with initiative_reference_num="${target_reference_num}". ` +
                      `To add a peer "Relates to" link instead: call create_record_link again with link_type=10.`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // No existing initiative — set via field setter
        if (srcType === "feature") {
          await this.restRequest(
            `/api/v1/features/${encodeURIComponent(source_reference_num)}`,
            "PUT",
            { feature: { initiative: target_reference_num } }
          );
        } else {
          await this.restRequest(
            `/api/v1/epics/${encodeURIComponent(source_reference_num)}`,
            "PUT",
            { epic: { initiative: target_reference_num } }
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  mechanism: "field_setter",
                  source: source_reference_num,
                  target: target_reference_num,
                  relationship: "Belongs to initiative",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // --- Ownership routing: Feature/Epic → Release (field setter when no link_type) ---
      if (
        (srcType === "feature" || srcType === "epic") &&
        tgtType === "release" &&
        inputLinkType === undefined
      ) {
        if (srcType === "feature") {
          await this.restRequest(
            `/api/v1/features/${encodeURIComponent(source_reference_num)}`,
            "PUT",
            { feature: { release: target_reference_num } }
          );
        } else {
          await this.restRequest(
            `/api/v1/epics/${encodeURIComponent(source_reference_num)}`,
            "PUT",
            { epic: { release: target_reference_num } }
          );
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  mechanism: "field_setter",
                  source: source_reference_num,
                  target: target_reference_num,
                  relationship: "Belongs to release",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // --- Ownership routing: Feature → Epic (field setter when no link_type) ---
      if (
        srcType === "feature" &&
        tgtType === "epic" &&
        inputLinkType === undefined
      ) {
        await this.restRequest(
          `/api/v1/features/${encodeURIComponent(source_reference_num)}`,
          "PUT",
          { feature: { epic: target_reference_num } }
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  mechanism: "field_setter",
                  source: source_reference_num,
                  target: target_reference_num,
                  relationship: "Belongs to epic",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // --- Peer relationship via record_links API ---

      // Same-type pairs without link_type: ask the user to specify
      if (srcType === tgtType && inputLinkType === undefined) {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: false,
                  action_required: true,
                  message:
                    `link_type is required when linking two ${srcType} records. ` +
                    `Valid values: 10=Relates to, 20=Depends on, 30=Duplicated by, ` +
                    `40=Contained by, 50=Impacted by, 60=Blocked by, 80=Research for. ` +
                    `Please call create_record_link again with the intended link_type.`,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      // Hierarchy inference for cross-type pairs when link_type is omitted
      let effectiveLinkType = inputLinkType ?? 10;
      let effectiveSrcType = srcType;
      let effectiveSrcRef = source_reference_num;
      let effectiveTgtType = tgtType;
      let effectiveTgtRef = target_reference_num;
      let swapped = false;

      if (inputLinkType === undefined) {
        const srcOrder = (Handlers.HIERARCHY as readonly string[]).indexOf(srcType);
        const tgtOrder = (Handlers.HIERARCHY as readonly string[]).indexOf(tgtType);
        // If both are in the hierarchy and source is lower-order, swap
        if (srcOrder !== -1 && tgtOrder !== -1 && srcOrder < tgtOrder) {
          effectiveSrcType = tgtType;
          effectiveSrcRef = target_reference_num;
          effectiveTgtType = srcType;
          effectiveTgtRef = source_reference_num;
          swapped = true;
        }
      }

      const apiPath = Handlers.RECORD_TYPE_API_PATH[effectiveSrcType];
      if (!apiPath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unsupported record type: ${effectiveSrcType}`
        );
      }
      const tgtBodyType = Handlers.RECORD_TYPE_BODY[effectiveTgtType];
      if (!tgtBodyType) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Unsupported record type: ${effectiveTgtType}`
        );
      }

      // Resolve both sides to internal IDs
      const sourceRecord = await this.resolveRecord(effectiveSrcType, effectiveSrcRef);
      const targetRecord = await this.resolveRecord(effectiveTgtType, effectiveTgtRef);

      await this.restRequest(
        `/api/v1/${apiPath}/${encodeURIComponent(String(sourceRecord.id))}/record_links`,
        "POST",
        {
          record_link: {
            record_type: tgtBodyType,
            record_id: targetRecord.id,
            link_type: effectiveLinkType,
          },
        }
      );

      const relationship =
        Handlers.LINK_TYPE_LABELS[effectiveLinkType] ?? `Type ${effectiveLinkType}`;

      const resultObj: Record<string, unknown> = {
        success: true,
        mechanism: "record_link",
        source: effectiveSrcRef,
        target: effectiveTgtRef,
        relationship,
      };
      if (swapped) {
        resultObj.note = `Source and target were swapped to match the Aha! ownership hierarchy (${effectiveSrcType} is higher-order than ${effectiveTgtType}).`;
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(resultObj, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("(403)")) {
        throw new McpError(
          ErrorCode.InternalError,
          `Permission denied creating record link: ${msg}`
        );
      }
      if (msg.includes("(422)")) {
        throw new McpError(
          ErrorCode.InternalError,
          `Invalid link configuration (unsupported type combination or missing field): ${msg}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create record link: ${msg}`
      );
    }
  }

  async handleListRecordLinks(request: any) {
    const { record_type, reference_num } = request.params.arguments as {
      record_type: string;
      reference_num: string;
    };

    if (!record_type || !reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "record_type and reference_num are required"
      );
    }

    const apiPath = Handlers.RECORD_TYPE_API_PATH[record_type.toLowerCase()];
    if (!apiPath) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Unsupported record type: ${record_type}`
      );
    }

    try {
      const record = await this.resolveRecord(
        record_type.toLowerCase(),
        reference_num
      );

      const data = await this.restRequest<any>(
        `/api/v1/${apiPath}/${encodeURIComponent(String(record.id))}/record_links?parent_and_child_links=true`,
        "GET"
      );

      const links: any[] = Array.isArray(data?.record_links)
        ? data.record_links
        : [];

      const result = links.map((link: any) => ({
        link_id: String(link.id ?? ""),
        relationship:
          link.link_type_name ??
          Handlers.LINK_TYPE_LABELS[link.link_type] ??
          `Type ${link.link_type}`,
        linked_record_type: link.record?.type ?? "",
        linked_record_reference_num: link.record?.reference_num ?? "",
        linked_record_name: link.record?.name ?? "",
        linked_record_status: link.record?.workflow_status?.name ?? "",
      }));

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list record links: ${msg}`
      );
    }
  }

  async handleDeleteRecordLink(request: any) {
    const { link_id } = request.params.arguments as { link_id: string };

    if (!link_id) {
      throw new McpError(ErrorCode.InvalidParams, "link_id is required");
    }

    try {
      await this.restRequest<any>(
        `/api/v1/record_links/${encodeURIComponent(link_id)}`,
        "DELETE"
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ success: true, link_id }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) throw error;
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("(404)")) {
        throw new McpError(
          ErrorCode.InternalError,
          `Record link not found (link_id: ${link_id}): ${msg}`
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to delete record link: ${msg}`
      );
    }
  }

  async handleUpdateInitiative(request: any) {
    const { reference_num, product_id, name, description, goal_ids } =
      request.params.arguments as {
        reference_num: string;
        product_id: string;
        name?: string;
        description?: string;
        goal_ids?: string[];
      };

    if (!reference_num) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Initiative reference_num is required"
      );
    }

    if (!product_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "product_id is required"
      );
    }

    if (name === undefined && description === undefined && goal_ids === undefined) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "At least one of name, description, or goal_ids must be provided"
      );
    }

    const initiativePayload: { [key: string]: unknown } = {};
    if (name !== undefined) {
      initiativePayload.name = name;
    }
    if (description !== undefined) {
      initiativePayload.description = description;
    }
    if (goal_ids !== undefined) {
      initiativePayload.goals = goal_ids;
    }

    try {
      const result = await this.restRequest(
        `/api/v1/products/${encodeURIComponent(product_id)}/initiatives/${encodeURIComponent(reference_num)}`,
        "PUT",
        { initiative: initiativePayload }
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to update initiative: ${errorMessage}`
      );
    }
  }

}
