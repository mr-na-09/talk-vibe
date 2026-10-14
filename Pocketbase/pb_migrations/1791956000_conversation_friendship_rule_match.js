migrate((app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const acceptedFriendship =
    "((@collection.friendships:direct.user_a ?= @request.auth.id && " +
    "@collection.friendships:direct.user_b ?= direct_friend) || " +
    "(@collection.friendships:direct.user_b ?= @request.auth.id && " +
    "@collection.friendships:direct.user_a ?= direct_friend))";
  const acceptedGroupFriendship =
    "((@collection.friendships:group.user_a ?= @request.auth.id && " +
    "@collection.friendships:group.user_b ?= participants.id) || " +
    "(@collection.friendships:group.user_b ?= @request.auth.id && " +
    "@collection.friendships:group.user_a ?= participants.id))";

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
});
