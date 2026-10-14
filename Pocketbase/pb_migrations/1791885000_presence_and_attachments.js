migrate((app) => {
  const profiles = app.findCollectionByNameOrId("profiles");
  profiles.fields.add(new DateField({ name: "last_seen" }));
  app.save(profiles);

  const messages = app.findCollectionByNameOrId("messages");
  const attachments = messages.fields.getByName("attachments");
  attachments.mimeTypes = [];
  attachments.maxSize = 52428800;
  app.save(messages);
}, (app) => {
  const profiles = app.findCollectionByNameOrId("profiles");
  profiles.fields.removeByName("last_seen");
  app.save(profiles);

  const messages = app.findCollectionByNameOrId("messages");
  const attachments = messages.fields.getByName("attachments");
  attachments.mimeTypes = [
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
  ];
  attachments.maxSize = 52428800;
  app.save(messages);
});
