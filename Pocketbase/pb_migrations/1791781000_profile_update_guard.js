migrate((app) => {
  const profiles = app.findCollectionByNameOrId("profiles");
  profiles.updateRule =
    "user = @request.auth.id && user = @request.body.user && talkvibe_id = @request.body.talkvibe_id";
  app.save(profiles);
}, (app) => {
  const profiles = app.findCollectionByNameOrId("profiles");
  profiles.updateRule = "user = @request.auth.id";
  app.save(profiles);
});
