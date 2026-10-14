migrate((app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const users = app.findCollectionByNameOrId("users");
  conversations.fields.add(
    new RelationField({
      name: "direct_friend",
      collectionId: users.id,
      maxSelect: 1,
      cascadeDelete: true,
    }),
  );

  const acceptedFriendship =
    "((@collection.friendships.user_a = @request.auth.id && " +
    "@collection.friendships.user_b = direct_friend) || " +
    "(@collection.friendships.user_b = @request.auth.id && " +
    "@collection.friendships.user_a = direct_friend))";
  const acceptedGroupFriendship =
    "((@collection.friendships.user_a = @request.auth.id && " +
    "@collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && " +
    "@collection.friendships.user_a ?= participants.id))";

  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id && " +
    "((is_group = false && participants:length = 2 && direct_friend != '' && " +
    "direct_friend != @request.auth.id && participants.id ?= direct_friend && " +
    acceptedFriendship +
    ") || (is_group = true && title != '' && " +
    acceptedGroupFriendship +
    "))";
  app.save(conversations);
}, (app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  conversations.fields.removeByName("direct_friend");
  conversations.createRule =
    "created_by = @request.auth.id && " +
    "@request.body.participants ?= @request.auth.id && " +
    "((is_group = false && @request.body.participants:length = 2 && " +
    "((@collection.friend_requests.sender = @request.auth.id && " +
    "@collection.friend_requests.receiver ?= @request.body.participants && " +
    "@collection.friend_requests.status = 'accepted') || " +
    "(@collection.friend_requests.receiver = @request.auth.id && " +
    "@collection.friend_requests.sender ?= @request.body.participants && " +
    "@collection.friend_requests.status = 'accepted'))) || " +
    "(is_group = true && title != '' && " +
    "((@collection.friendships.user_a = @request.auth.id && " +
    "@collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && " +
    "@collection.friendships.user_a ?= participants.id))))";
  app.save(conversations);
});
