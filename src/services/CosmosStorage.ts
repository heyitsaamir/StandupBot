import { Container, CosmosClient, PartitionKeyDefinition } from "@azure/cosmos";
import { StandupResponse, User } from "../models/types";

export interface IStorage<TKey = any, TValue = any> {
  get(key: TKey): TValue | undefined | Promise<TValue | undefined>;
  set(key: TKey, value: TValue & { id: string }): void | Promise<void>;
  delete(key: TKey, partitionKey: string): void | Promise<void>;
}

export class CosmosStorage<TKey extends string | number = string, TValue = any>
  implements IStorage<TKey, TValue>
{
  constructor(
    private container: Container,
    private partitionKeyPath: string = "/id"
  ) {}

  async get(key: TKey): Promise<TValue | undefined> {
    try {
      // Use partition key if available in the item
      const { resources } = await this.container.items
        .query({
          query: "SELECT * FROM c WHERE c.id = @id AND IS_DEFINED(c.tenantId)",
          parameters: [{ name: "@id", value: key.toString() }],
        })
        .fetchAll();
      return resources.length > 0 ? resources[0] : undefined;
    } catch (error) {
      if ((error as any).code === 404) return undefined;
      throw error;
    }
  }

  async set(key: TKey, value: TValue & { id: string }): Promise<void> {
    await this.container.items.upsert(value);
  }

  async delete(key: TKey, partitionKey: string): Promise<void> {
    await this.container.item(key.toString(), partitionKey).delete();
  }
}

export class CosmosStorageFactory {
  private static client: CosmosClient;
  private static containers = new Map<string, Container>();

  static initialize(connectionString: string) {
    this.client = new CosmosClient(connectionString);
  }

  static async getStorage<TKey extends string | number = string, TValue = any>(
    databaseName: string,
    containerName: string,
    partitionKeyPath: string = "/id"
  ): Promise<CosmosStorage<TKey, TValue>> {
    // Validate initialization
    if (!this.client) {
      throw new Error(
        "CosmosStorageFactory not initialized. Call initialize() first."
      );
    }

    const cacheKey = `${databaseName}:${containerName}`;

    if (!this.containers.has(cacheKey)) {
      try {
        // Create database if it doesn't exist
        const { database } = await this.client.databases.createIfNotExists({
          id: databaseName,
        });

        // Create container if it doesn't exist
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: {
            paths: [partitionKeyPath],
            kind: "Hash",
          } as PartitionKeyDefinition,
        });

        this.containers.set(cacheKey, container);
      } catch (error) {
        throw new Error(
          `Failed to initialize storage for ${containerName}: ${error}`
        );
      }
    }

    return new CosmosStorage(this.containers.get(cacheKey)!, partitionKeyPath);
  }
}

export interface StandupSummary {
  date: Date;
  participants: User[];
  responses: StandupResponse[];
  parkingLot?: string[];
}

// Unified storage type
export interface BaseStorageItem {
  id: string; // conversationId
  tenantId: string; // partition key
}

export interface GroupStorageItem extends BaseStorageItem {
  type: "group";
  users: User[];
  isActive: boolean;
  activeResponses: StandupResponse[];
  storage: {
    type: string;
    targetId?: string;
  };
  activeStandupActivityId: string | null;
}

export interface HistoryStorageItem extends BaseStorageItem {
  type: "history";
  summaries: StandupSummary[];
}

export type StandupStorageItem = GroupStorageItem | HistoryStorageItem;
