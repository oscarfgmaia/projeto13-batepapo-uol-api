import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";

const app = express();

//config
app.use(cors());
app.use(express.json());
dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient
  .connect()
  .then(() => {
    console.log("connected to database");
    db = mongoClient.db("batePapoUol");
  })
  .catch((err) => {
    console.log(err);
  });

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  const participant = {
    name,
    lastStatus: Date.now(),
  };

  const logInMessage = {
    from: name,
    to: "Todos",
    text: "entra na sala...",
    type: "status",
    time: dayjs(participant.lastStatus).format("HH:mm:ss"),
  };

  try {
    await db.collection("participants").insertOne(participant);
    await db.collection("messages").insertOne(logInMessage);
    res.sendStatus(201);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.get("/participants", (req, res) => {
  db.collection("participants")
    .find()
    .toArray()
    .then((participants) => {
      res.send(participants);
    })
    .catch((err) => {
      res.send(err);
    });
});

app.post("/messages", (req, res) => {
  const { to, text, type } = req.body;
  const { user } = req.headers;
  const message = {
    from: user,
    to,
    text,
    type,
    time: dayjs(Date.now()).format("HH:mm:ss"),
  };
  db.collection("messages")
    .insertOne(message)
    .then(() => {
      res.status(201);
    })
    .catch(() => {
      res.sendStatus(500);
    });
});

app.get("/messages", (req, res) => {
  db.collection("messages")
    .find({})
    .toArray()
    .then((msgs) => {
      res.send(msgs);
    })
    .catch((err) => {
      res.send(err);
    });
});

//TODO
app.post("/status", (req, res) => {
  const { user } = req.headers;
  db.collection("participants")
    .updateOne(
      { user: user },
      {
        $set: {
          lastStatus: Date.now(),
        },
      }
    )
    .then((response) => {
      console.log(response);
    })
    .catch((err) => {
      console.log(err);
    });
});

app.listen(5000, () => {
  console.log("Server is running at port 5000");
});
