migrate((app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const acceptedDirectFriendRequest =
    "((@collection.friend_requests.sender = @request.auth.id && " +
    "@collection.friend_requests.receiver ?= participants.id && " +
    "@collection.friend_requests.status = 'accepted') || " +
    "(@collection.friend_requests.receiver = @request.auth.id && " +
    "@collection.friend_requests.sender ?= participants.id && " +
    "@collection.friend_requests.status = 'accepted'))";
  const acceptedFriendship =
    "((@collection.friendships.user_a = @request.auth.id && " +
    "@collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && " +
    "@collection.friendships.user_a ?= participants.id))";

  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id && " +
    "((is_group = false && participants:length = 2 && " +
    acceptedDirectFriendRequest +
    ") || (is_group = true && title != '' && " +
    acceptedFriendship +
    "))";
  app.save(conversations);
}, (app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  conversations.createRule =
    "created_by = @request.auth.id && " +
    "participants.id ?= @request.auth.id && (" +
    "(@collection.friendships.user_a = @request.auth.id && @collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && @collection.friendships.user_a ?= participants.id))";
  app.save(conversations);
});
