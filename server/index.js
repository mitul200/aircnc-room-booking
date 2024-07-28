const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const nodemailer = require("nodemailer");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.PATMENT_SECRET_KEY);

// middleware
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());

// pass
// khaled22

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.n0w8anz.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mq0mae1.mongodb.net/?retryWrites=true&w=majority`

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// const verify --- JWT
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ err: true, massage: "Unauthorize Access" });
  }
  const token = authorization.split(" ")[1];
  console.log("token author", token);
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ err: true, massage: "Unauthorize Access" });
    }
    req.decoded = decoded;
    next();
  });
};

// mitul123

const sendMail = (emailData, emailAddress) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL,
      pass: process.env.PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL,
    to: emailAddress,
    subject: emailData.subject,
    html: `<p>${emailData?.message}</p>`,
  };
  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
      // do something useful
    }
  });
};

async function run() {
  try {
    const usersCollection = client.db("aircncDb").collection("users");
    const roomsCollection = client.db("aircncDb").collection("rooms");
    const bookingsCollection = client.db("aircncDb").collection("bookings");

    // Generate client secret
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;
      console.log("price for payment=>>>>>>>>>", price);
      if (price) {
        const amount = parseFloat(price) * 100;
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: "usd",
          payment_method_types: ["card"],
        });
        // const paymentIntent = await stripe.paymentIntents.creat({
        //   amount: amount,
        //   currency: "usd",
        //   payment_method_types: ["card"],
        // });
        res.send({ clientSecret: paymentIntent.client_secret });
      }
    });

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "2d",
      });
      // console.log("jwt email token", { token });
      res.send({ token });
    });

    // Save user email and role in DB
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      // console.log(result);
      res.send(result);
    });

    // Get user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await usersCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    // Get all rooms
    app.get("/rooms", async (req, res) => {
      const result = await roomsCollection.find().toArray();
      res.send(result);
    });

    // delete room
    app.delete("/rooms/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.deleteOne(query);
      res.send(result);
    });

    // Get all room for host
    app.get("/rooms/:email", verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      console.log("decodedEmail =>>>>>> ", decodedEmail);

      const email = req.params.email;
      if (email !== decodedEmail) {
        req.status(403).send({ err: true, massage: "Forbidden Access" });
      }
      const query = { "host.email": email };
      const result = await roomsCollection.find(query).toArray();

      // console.log(result);
      res.send(result);
    });

    // Get a single room
    app.get("/room/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await roomsCollection.findOne(query);
      // console.log(result);
      res.send(result);
    });

    // Save a room in database
    app.post("/rooms", async (req, res) => {
      const room = req.body;
      // console.log(room);
      const result = await roomsCollection.insertOne(room);
      res.send(result);
    });

    // update room booking status
    app.patch("/rooms/status/:id", async (req, res) => {
      const id = req.params.id;
      const status = req.body.status;
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          booked: status,
        },
      };
      const update = await roomsCollection.updateOne(query, updateDoc);
      res.send(update);
    });

    // Get bookings for guest
    app.get("/bookings", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { "guest.email": email };
      // console.log("from my bookings", query);
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
      // console.log("from managebookings", result);
    });

    // Get bookings for host
    app.get("/bookings/host", async (req, res) => {
      const email = req.query.email;
      if (!email) {
        res.send([]);
      }
      const query = { host: email };
      // console.log("query from manageBookings", query);
      const result = await bookingsCollection.find(query).toArray();
      res.send(result);
      console.log("from managebookings ", result);
    });

    // Save a booking in database
    app.post("/bookings", async (req, res) => {
      const booking = req.body;
      console.log(booking);
      const result = await bookingsCollection.insertOne(booking);
      // send confirmation email to guest email account
      sendMail(
        {
          subject: "bookings Successfull",
          message: `booking id: ${result?.insertedId}, You'r Transaction_Id: ${booking?.transaction}`,
        },
        booking?.guest?.email
      );

      // send confirmation to host email account
      sendMail(
        {
          subject: "Your rooms get booked!",
          message: `booking id:${result.insertedId}, Transaction_Id: ${booking.transaction}`,
        },
        booking?.host
      );
      res.send(result);
    });

    // delete a booking

    app.delete("/bookings/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bookingsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("AirCNC Server is running..");
});

app.listen(port, () => {
  console.log(`AirCNC is running on port ${port}`);
});
