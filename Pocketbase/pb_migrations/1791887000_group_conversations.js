migrate((app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const participants = conversations.fields.getByName("participants");
  participants.maxSelect = 20;
  conversations.fields.add(new BoolField({ name: "is_group" }));
  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id && " +
    "((is_group = false && (" +
    "(@collection.friendships.user_a = @request.auth.id && @collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && @collection.friendships.user_a ?= participants.id))) || " +
    "(is_group = true && title != '' && (" +
    "(@collection.friendships.user_a = @request.auth.id && @collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && @collection.friendships.user_a ?= participants.id))))";
  app.save(conversations);
}, (app) => {
  const conversations = app.findCollectionByNameOrId("conversations");
  const participants = conversations.fields.getByName("participants");
  participants.maxSelect = 2;
  conversations.fields.removeByName("is_group");
  conversations.createRule =
    "created_by = @request.auth.id && participants.id ?= @request.auth.id && (" +
    "(@collection.friendships.user_a = @request.auth.id && @collection.friendships.user_b ?= participants.id) || " +
    "(@collection.friendships.user_b = @request.auth.id && @collection.friendships.user_a ?= participants.id))";
  app.save(conversations);
});
