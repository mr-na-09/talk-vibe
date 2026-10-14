migrate((app) => {
  const friendships = app.findCollectionByNameOrId("friendships");
  friendships.createRule =
    "@collection.friend_requests.sender = user_a && " +
    "@collection.friend_requests.receiver = user_b && " +
    "@collection.friend_requests.receiver = @request.auth.id && " +
    "@collection.friend_requests.status = 'accepted'";
  friendships.indexes = [
    ...friendships.indexes,
    "CREATE UNIQUE INDEX idx_friendships_pair_normalized ON friendships (MIN(user_a, user_b), MAX(user_a, user_b))",
  ];
  app.save(friendships);

  const conversations = app.findCollectionByNameOrId("conversations");
  conversations.createRule =
    "created_by = @request.auth.id && " +
    "participants.id ?= @request.auth.id && (" +
    "(@collection.friendships.user_a = @request.auth.id && @collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && @collection.friendships.user_a ?= participants.id))";
  app.save(conversations);

  const friendRequests = app.findCollectionByNameOrId("friend_requests");
  friendRequests.indexes = [
    ...friendRequests.indexes,
    "CREATE UNIQUE INDEX idx_friend_requests_pair_normalized ON friend_requests (MIN(sender, receiver), MAX(sender, receiver))",
  ];
  app.save(friendRequests);
}, (app) => {
  const friendships = app.findCollectionByNameOrId("friendships");
  friendships.createRule =
    "@collection.friend_requests.sender = user_a && @collection.friend_requests.receiver = user_b && @collection.friend_requests.status = 'accepted'";
  friendships.indexes = friendships.indexes.filter(
    (index) => !index.includes("idx_friendships_pair_normalized"),
  );
  app.save(friendships);

  const conversations = app.findCollectionByNameOrId("conversations");
  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id";
  app.save(conversations);

  const friendRequests = app.findCollectionByNameOrId("friend_requests");
  friendRequests.indexes = friendRequests.indexes.filter(
    (index) => !index.includes("idx_friend_requests_pair_normalized"),
  );
  app.save(friendRequests);
});
