import express from "express";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";
import dayjs from "dayjs";
import joi from "joi";

const app = express();

//config
app.use(cors());
app.use(express.json());
dotenv.config();

//connect to database
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

//schemas - joi
const participantSchema = joi.object({
  name: joi.string().alphanum().required(),
  lastStatus: joi.number().required(),
});

const messageSchema = joi.object({
  from: joi.string().required(),
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
  time: joi.string().required(),
});

app.post("/participants", async (req, res) => {
  try {
    const { name } = req.body;
    const alreadyRegistered = await db
      .collection("participants")
      .findOne({ name: name });

    if (alreadyRegistered) {
      res.sendStatus(409);
      return;
    }

    const participant = {
      name,
      lastStatus: Date.now(),
    };

    const participantValidation = participantSchema.validate(participant, {
      abortEarly: false,
    });
    console.log(participantValidation);

    if (participantValidation.error) {
      const erros = participantValidation.error;
      res.status(422).send(erros);
      return;
    }

    const logInMessage = {
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time: dayjs(participant.lastStatus).format("HH:mm:ss"),
    };

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

app.post("/messages", async (req, res) => {
  try {
    const { to, text, type } = req.body;
    const foundUser = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!foundUser) {
      res.status(422).send({ message: "User not found" });
      return;
    }
    const message = {
      from: foundUser.name,
      to,
      text,
      type,
      time: dayjs(Date.now()).format("HH:mm:ss"),
    };
    const messageValidation = messageSchema.validate(message, {
      abortEarly: false,
    });
    if (messageValidation.error) {
      const erros = messageValidation.error.details.map(
        (detail) => detail.message
      );
      res.status(422).send(erros);
      return;
    }
    await db.collection("messages").insertOne(message);
    res.sendStatus(201);
  } catch (err) {
    console.log(err);
    res
      .status(500)
      .send({ message: "Something went wrong with the database." });
  }
});
//front enviando limit por padrao
app.get("/messages", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit);
    let messages = await db.collection("messages").find({}).toArray();
    console.log(limit)
    if (limit) {
      messages = messages.filter((e, index) => index < limit);
      console.log(messages.length);
    }
    
    res.send(messages);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

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
