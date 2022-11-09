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

app.post("/participants", (req, res) => {
    console.log("Entrou no post")
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

  db.collection("participants")
    .insertOne(participant)
    .then((response) => {
      db.collection("messages")
        .insertOne(logInMessage)
        .then(() => {
          res.sendStatus(201);
        })
        .catch((err) => {
          res.sendStatus(500);
        });
    })
    .catch((err) => {
      res.status(500).send(err);
    });
});


app.get("/participants",(req,res)=>{
  db.collection("participants").find().toArray()
  .then((participants)=>{
    res.send(participants)
  })
  .catch((err)=>{
    res.send(err)
  })
})


app.listen(5000, () => {
  console.log("Server is running at port 5000");
});
