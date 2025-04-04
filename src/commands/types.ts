export interface CommandContext {
  send: (message: any) => Promise<any>;
  conversationId: string;
  userId: string;
  userName: string;
  api: any;
  mentions: Array<{ id: string; name: string }>;
  signin?: (options?: any) => Promise<any>;
  isSignedIn?: boolean;
}

export interface Command {
  name: string;
  execute: (context: CommandContext) => Promise<void>;
}
