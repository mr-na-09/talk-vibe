migrate((app) => {
  const users = app.findCollectionByNameOrId("users");
  const conversations = app.findCollectionByNameOrId("conversations");
  const participants = conversations.fields.getByName("participants");
  participants.minSelect = 0;
  app.save(conversations);

  const directFriendship =
    "((@collection.friendships:direct.user_a ?= @request.auth.id && " +
    "@collection.friendships:direct.user_b ?= direct_friend) || " +
    "(@collection.friendships:direct.user_b ?= @request.auth.id && " +
    "@collection.friendships:direct.user_a ?= direct_friend))";
  const groupFriendship =
    "((@collection.friendships:group.user_a ?= @request.auth.id && " +
    "@collection.friendships:group.user_b ?= participants.id) || " +
    "(@collection.friendships:group.user_b ?= @request.auth.id && " +
    "@collection.friendships:group.user_a ?= participants.id))";

  conversations.listRule =
    "((is_group = false && (created_by = @request.auth.id || " +
    "direct_friend = @request.auth.id || " +
    "(direct_friend = '' && participants.id ?= @request.auth.id))) || " +
    "(is_group = true && participants.id ?= @request.auth.id))";
  conversations.viewRule = conversations.listRule;
  conversations.createRule =
    "created_by = @request.auth.id && " +
    "((is_group = false && direct_friend != '' && " +
    "direct_friend != @request.auth.id && " +
    "participants:length = 2 && " +
    directFriendship +
    ") || (is_group = true && title != '' && " +
    "participants.id ?= @request.auth.id && " +
    groupFriendship +
    "))";
  app.save(conversations);

  const directConversationAccess =
    "((conversation.is_group = false && " +
    "(conversation.created_by = @request.auth.id || " +
    "conversation.direct_friend = @request.auth.id || " +
    "(conversation.direct_friend = '' && " +
    "conversation.participants.id ?= @request.auth.id))) || " +
    "(conversation.is_group = true && " +
    "conversation.participants.id ?= @request.auth.id))";
  const messages = app.findCollectionByNameOrId("messages");
  messages.listRule = directConversationAccess;
  messages.viewRule = directConversationAccess;
  messages.createRule =
    "sender = @request.auth.id && " + directConversationAccess;
  messages.updateRule =
    "sender = @request.auth.id && " +
    "sender = @request.body.sender && " +
    "conversation = @request.body.conversation && " +
    directConversationAccess;
  app.save(messages);

  const receipts = app.findCollectionByNameOrId("read_receipts");
  const receiptConversationAccess =
    "((message.conversation.is_group = false && " +
    "(message.conversation.created_by = @request.auth.id || " +
    "message.conversation.direct_friend = @request.auth.id || " +
    "(message.conversation.direct_friend = '' && " +
    "message.conversation.participants.id ?= @request.auth.id))) || " +
    "(message.conversation.is_group = true && " +
    "message.conversation.participants.id ?= @request.auth.id))";
  receipts.listRule = receiptConversationAccess;
  receipts.viewRule = receiptConversationAccess;
  receipts.createRule =
    "user = @request.auth.id && " + receiptConversationAccess;
  app.save(receipts);
}, (app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const participants = conversations.fields.getByName("participants");
  participants.minSelect = 2;
  conversations.listRule = "participants.id ?= @request.auth.id";
  conversations.viewRule = "participants.id ?= @request.auth.id";
  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id && " +
    "((is_group = false && participants:length = 2 && direct_friend != '' && " +
    "direct_friend != @request.auth.id && participants.id ?= direct_friend && " +
    "((@collection.friendships:direct.user_a ?= @request.auth.id && " +
    "@collection.friendships:direct.user_b ?= direct_friend) || " +
    "(@collection.friendships:direct.user_b ?= @request.auth.id && " +
    "@collection.friendships:direct.user_a ?= direct_friend))) || " +
    "(is_group = true && title != '' && " +
    "((@collection.friendships:group.user_a ?= @request.auth.id && " +
    "@collection.friendships:group.user_b ?= participants.id) || " +
    "(@collection.friendships:group.user_b ?= @request.auth.id && " +
    "@collection.friendships:group.user_a ?= participants.id))))";
  app.save(conversations);

  const participantConversationAccess =
    "conversation.participants.id ?= @request.auth.id";
  const messages = app.findCollectionByNameOrId("messages");
  messages.listRule = participantConversationAccess;
  messages.viewRule = participantConversationAccess;
  messages.createRule =
    "sender = @request.auth.id && " + participantConversationAccess;
  messages.updateRule =
    "sender = @request.auth.id && " +
    "sender = @request.body.sender && " +
    "conversation = @request.body.conversation && " +
    participantConversationAccess;
  app.save(messages);

  const receipts = app.findCollectionByNameOrId("read_receipts");
  const receiptConversationAccess =
    "message.conversation.participants.id ?= @request.auth.id";
  receipts.listRule = receiptConversationAccess;
  receipts.viewRule = receiptConversationAccess;
  receipts.createRule =
    "user = @request.auth.id && " + receiptConversationAccess;
  app.save(receipts);
});
