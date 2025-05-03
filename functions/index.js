const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Configuration, OpenAIApi } = require("openai");

admin.initializeApp();
const db = admin.firestore();
const openai = new OpenAIApi(
  new Configuration({ apiKey: functions.config().openai.key })
);

// — save_dom_snapshot — store latest elements
exports.saveDomSnapshot = functions.https.onRequest(async (req, res) => {
  try {
    const { url, userId, timestamp, elements } = req.body;
    await db
      .collection("snapshots")
      .doc(`${url}_${timestamp}`)
      .set({ url, userId, timestamp, elements });
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// — retrieve_memory — get last N by URL
exports.retrieveMemory = functions.https.onRequest(async (req, res) => {
  try {
    const { url, limit = 5 } = req.body;
    const snaps = await db
      .collection("snapshots")
      .where("url", "==", url)
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    const memories = snaps.docs.map((d) => d.data());
    res.json({ memories });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});

// — record_interaction — log user feedback
exports.recordInteraction = functions.https.onRequest(async (req, res) => {
  try {
    const { userId, url, query, stepsOffered, timestamp } = req.body;
    await db
      .collection("interactions")
      .add({ userId, url, query, stepsOffered, timestamp });
    res.json({ status: "ok" });
  } catch (e) {
    res.status(500).json({ error: e.toString() });
  }
});
