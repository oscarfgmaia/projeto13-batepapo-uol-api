import express from "express";
import { MongoClient, ObjectId } from "mongodb";
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

async function checkOnlineParticipants() {
  try {
    const participants = await db.collection("participants").find({}).toArray();
    const timeNow = Date.now();
    const participantsToBeDeleted = participants.filter((participant) => {
      if (timeNow - participant.lastStatus >= 10000) {
        return true;
      } else {
        return false;
      }
    });

    for (let i = 0; i < participantsToBeDeleted.length; i++) {
      const exitMessage = {
        from: participantsToBeDeleted[i].name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs(participantsToBeDeleted.lastStatus).format("HH:mm:ss"),
      };
      await db
        .collection("participants")
        .deleteOne({ _id: ObjectId(participantsToBeDeleted[i]._id) });
      await db.collection("messages").insertOne(exitMessage);
      console.log(participantsToBeDeleted[i]._id);
    }
  } catch (error) {
    console.log(`CHECK ONLINE: ${error}`)
  }
}
setInterval(checkOnlineParticipants,15000)


app.post("/participants", async (req, res) => {
  const { name } = req.body;
  try {
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

    if (participantValidation.error) {
      const erros = participantValidation.error.details.map(
        (details) => details.message
      );
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
  const { to, text, type } = req.body;
  try {
    const foundUser = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!foundUser) {
      res.status(404).send({ message: "User not found" });
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
  const limit = parseInt(req.query.limit);
  try {
    const foundUser = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!foundUser) {
      res.status(404).send({ message: "User not found" });
      return;
    }
    let messages = await db.collection("messages").find({}).toArray();
    if (limit) {
      //messages = messages.filter((msg, index) => index < limit);
      const limitedMessages = [];
      for (let i = messages.length - 1; i >= 0; i--) {
        if (limitedMessages.length < limit) {
          if (
            messages[i].to === "Todos" ||
            messages[i].to === foundUser.name ||
            messages[i].type === "message" ||
            messages[i].from === foundUser.name
          ) {
            limitedMessages.unshift(messages[i]);
          }
        }
      }
      messages = limitedMessages;
    } else {
      messages = messages.filter((msg, i) => {
        if (
          messages[i].to === "Todos" ||
          messages[i].to === foundUser.name ||
          messages[i].type === "message" ||
          messages[i].from === foundUser.name
        ) {
          return true;
        } else {
          return false;
        }
      });
    }

    res.send(messages);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const timeNow = Date.now();
  try {
    const foundUser = await db
      .collection("participants")
      .findOne({ name: req.headers.user });
    if (!foundUser) {
      res.status(404).send({ message: "User not found" });
      return;
    }
    await db
      .collection("participants")
      .updateOne({ name: foundUser.name }, { $set: { lastStatus: timeNow } });

    res.status(200).send(req.headers.user);
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

app.listen(5000, () => {
  console.log("Server is running at port 5000");
});
