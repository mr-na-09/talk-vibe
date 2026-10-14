function makeFields(...items) {
  const fields = new FieldsList();
  fields.add(
    new AutodateField({ name: "created", onCreate: true }),
    new AutodateField({ name: "updated", onCreate: true, onUpdate: true }),
  );
  fields.add(...items);
  return fields;
}

migrate((app) => {
  const users = app.findCollectionByNameOrId("users");

  const profiles = new Collection({
    type: "base",
    name: "profiles",
    fields: makeFields(
      new RelationField({
        name: "user",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "display_name", required: true, max: 80 }),
      new TextField({ name: "username", required: true, max: 32 }),
      new TextField({ name: "talkvibe_id", required: true, max: 12 }),
      new EditorField({ name: "bio", max: 500 }),
      new FileField({
        name: "avatar",
        maxSelect: 1,
        maxSize: 4194304,
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        protected: true,
      }),
      new SelectField({
        name: "status",
        values: ["online", "away", "offline"],
        maxSelect: 1,
      }),
    ),
    indexes: [
      "CREATE UNIQUE INDEX idx_profiles_user ON profiles (user)",
      "CREATE UNIQUE INDEX idx_profiles_username ON profiles (LOWER(username))",
      "CREATE UNIQUE INDEX idx_profiles_talkvibe_id ON profiles (talkvibe_id)",
    ],
    listRule: "@request.auth.id != ''",
    viewRule: "@request.auth.id != ''",
    createRule: "user = @request.auth.id && talkvibe_id != ''",
    updateRule:
      "user = @request.auth.id && user = @request.body.user && talkvibe_id = @request.body.talkvibe_id",
    deleteRule: "user = @request.auth.id",
  });
  app.save(profiles);

  const friendRequests = new Collection({
    type: "base",
    name: "friend_requests",
    fields: makeFields(
      new RelationField({
        name: "sender",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "receiver",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new SelectField({
        name: "status",
        values: ["pending", "accepted", "rejected"],
        maxSelect: 1,
      }),
    ),
    indexes: [
      "CREATE UNIQUE INDEX idx_friend_requests_pair ON friend_requests (sender, receiver)",
      "CREATE INDEX idx_friend_requests_receiver_status ON friend_requests (receiver, status)",
    ],
    listRule:
      "sender = @request.auth.id || receiver = @request.auth.id",
    viewRule:
      "sender = @request.auth.id || receiver = @request.auth.id",
    createRule:
      "sender = @request.auth.id && sender != receiver && status = 'pending'",
    updateRule:
      "receiver = @request.auth.id && sender = @request.body.sender && receiver = @request.body.receiver && status = 'pending'",
    deleteRule: "sender = @request.auth.id && status = 'pending'",
  });
  app.save(friendRequests);

  const friendships = new Collection({
    type: "base",
    name: "friendships",
    fields: makeFields(
      new RelationField({
        name: "user_a",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "user_b",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
    ),
    indexes: [
      "CREATE UNIQUE INDEX idx_friendships_pair ON friendships (user_a, user_b)",
    ],
    listRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    viewRule: "user_a = @request.auth.id || user_b = @request.auth.id",
    createRule:
      "@collection.friend_requests.sender = user_a && @collection.friend_requests.receiver = user_b && @collection.friend_requests.status = 'accepted'",
    deleteRule: "user_a = @request.auth.id || user_b = @request.auth.id",
  });
  app.save(friendships);

  const conversations = new Collection({
    type: "base",
    name: "conversations",
    fields: makeFields(
      new RelationField({
        name: "participants",
        collectionId: users.id,
        maxSelect: 2,
        minSelect: 2,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "created_by",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "title", max: 120 }),
    ),
    indexes: [
      "CREATE INDEX idx_conversations_created_by ON conversations (created_by)",
    ],
    listRule: "participants.id ?= @request.auth.id",
    viewRule: "participants.id ?= @request.auth.id",
    createRule:
      "created_by = @request.auth.id && participants.id ?= @request.auth.id",
  });
  app.save(conversations);

  const messages = new Collection({
    type: "base",
    name: "messages",
    fields: makeFields(
      new RelationField({
        name: "conversation",
        collectionId: conversations.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "sender",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "text", max: 10000 }),
      new FileField({
        name: "attachments",
        maxSelect: 5,
        maxSize: 52428800,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "video/mp4",
          "application/pdf",
          "text/plain",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ],
        protected: true,
      }),
      new DateField({ name: "edited_at" }),
      new BoolField({ name: "deleted" }),
    ),
    indexes: [
      "CREATE INDEX idx_messages_conversation_created ON messages (conversation, created)",
      "CREATE INDEX idx_messages_sender ON messages (sender)",
    ],
    listRule: "conversation.participants.id ?= @request.auth.id",
    viewRule: "conversation.participants.id ?= @request.auth.id",
    createRule:
      "sender = @request.auth.id && conversation.participants.id ?= @request.auth.id",
    updateRule:
      "sender = @request.auth.id && sender = @request.body.sender && conversation = @request.body.conversation && conversation.participants.id ?= @request.auth.id",
    deleteRule: "sender = @request.auth.id",
  });
  app.save(messages);

  const readReceipts = new Collection({
    type: "base",
    name: "read_receipts",
    fields: makeFields(
      new RelationField({
        name: "message",
        collectionId: messages.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "user",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
    ),
    indexes: [
      "CREATE UNIQUE INDEX idx_read_receipts_message_user ON read_receipts (message, user)",
    ],
    listRule: "message.conversation.participants.id ?= @request.auth.id",
    viewRule: "message.conversation.participants.id ?= @request.auth.id",
    createRule:
      "user = @request.auth.id && message.conversation.participants.id ?= @request.auth.id",
  });
  app.save(readReceipts);

  const notifications = new Collection({
    type: "base",
    name: "notifications",
    fields: makeFields(
      new RelationField({
        name: "user",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new SelectField({
        name: "type",
        values: ["message", "friend_request", "friend_accepted", "system"],
        maxSelect: 1,
      }),
      new TextField({ name: "title", required: true, max: 120 }),
      new TextField({ name: "body", max: 500 }),
      new JSONField({ name: "metadata" }),
      new BoolField({ name: "is_read" }),
    ),
    indexes: [
      "CREATE INDEX idx_notifications_user_created ON notifications (user, created)",
    ],
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id && user = @request.body.user",
    deleteRule: "user = @request.auth.id",
  });
  app.save(notifications);

  const deviceTokens = new Collection({
    type: "base",
    name: "device_tokens",
    fields: makeFields(
      new RelationField({
        name: "user",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "token", required: true, max: 4096 }),
      new SelectField({
        name: "platform",
        values: ["web", "ios", "android"],
        maxSelect: 1,
      }),
    ),
    indexes: ["CREATE UNIQUE INDEX idx_device_tokens_token ON device_tokens (token)"],
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id && user = @request.body.user",
    deleteRule: "user = @request.auth.id",
  });
  app.save(deviceTokens);

  const blocks = new Collection({
    type: "base",
    name: "user_blocks",
    fields: makeFields(
      new RelationField({
        name: "blocker",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "blocked",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
    ),
    indexes: [
      "CREATE UNIQUE INDEX idx_user_blocks_pair ON user_blocks (blocker, blocked)",
    ],
    listRule: "blocker = @request.auth.id",
    viewRule: "blocker = @request.auth.id",
    createRule:
      "blocker = @request.auth.id && blocker != blocked",
    deleteRule: "blocker = @request.auth.id",
  });
  app.save(blocks);

  const reports = new Collection({
    type: "base",
    name: "user_reports",
    fields: makeFields(
      new RelationField({
        name: "reporter",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new RelationField({
        name: "reported",
        collectionId: users.id,
        maxSelect: 1,
        minSelect: 1,
        cascadeDelete: true,
      }),
      new TextField({ name: "reason", required: true, max: 2000 }),
    ),
    createRule: "reporter = @request.auth.id && reporter != reported",
  });
  app.save(reports);
}, (app) => {
  const collectionNames = [
    "user_reports",
    "user_blocks",
    "device_tokens",
    "notifications",
    "read_receipts",
    "messages",
    "conversations",
    "friendships",
    "friend_requests",
    "profiles",
  ];

  for (const name of collectionNames) {
    const collection = app.findCollectionByNameOrId(name);
    if (collection) {
      app.delete(collection);
    }
  }
});
