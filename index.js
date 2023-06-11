const express = require('express');
const cors = require('cors')
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)


const app = express();
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())

//jwt verify middleware
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unouthorized access" });
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            res.status(401).send({ error: true, message: 'unouthorized access' })
        }
        req.decoded = decoded;
        next()
    })
}




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.oajesmx.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        //collections
        const instructorCollection = client.db('Summer-Camp').collection('instructor');

        const userCollection = client.db('Summer-Camp').collection('user');

        const popularClassCollection = client.db('Summer-Camp').collection('Popularclass');

        const classesCollection = client.db('Summer-Camp').collection('classes');

        const selectedClassCollection = client.db('Summer-Camp').collection('SelectedClasses');

        const paymentCollection = client.db('Summer-Camp').collection('payments');



        //JWT
        app.post('/jwt', (req, res) => {
            const email = req.body;
            const token = jwt.sign(email, process.env.JWT_SECRET, { expiresIn: '1h' })
            res.send({ token })

        })


        //verify instructor
        const verifyInsructor = async(req, res, next)=>{
            const email = req.decoded.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);
            if(user.role !== 'instructor'){
                return res.status(403).send({error: true, message: 'forbidden access'})
            }
            next()
        }


        //save user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const query = { email: email };
            const option = { upsert: true };
            const updateDoc = { $set: user }

            const result = await userCollection.updateOne(query, updateDoc, option);
            res.send(result)
        })


        //get instructor
        app.get('/user/instructor/:email', verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);

            const result ={instructor: user?.role === 'instructor'}
            res.send(result)
        })

        // update class data 
        app.patch('/instructor/update-class/:id',verifyJWT, verifyInsructor, async(req, res)=>{
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const classData = req.body;
            const updateDoc = {
                $set: {
                    className: classData.className,
                    availableSeats: classData.availableSeats,
                    price: classData.price
                }
            }
        
            const result = await classesCollection.updateOne(query, updateDoc)
            res.send(result)

        })

        // get all instructor
        app.get('/instructor', async (req, res) => {

            const result = await instructorCollection.find().sort({ students: -1 }).limit(6).toArray()
            res.send(result)
        })

        ///Popular Art and Craft Classes data
        app.get('/popular-class', async (req, res) => {
            const result = await popularClassCollection.find().toArray();
            res.send(result)
        })

        // clesses page
        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result)
        })

        app.post('/instructor/add-class',verifyJWT, verifyInsructor, async(req, res)=>{
            const classData = req.body;
            const result = await classesCollection.insertOne(classData);
            res.send(result)
        })

        // get instructor class
        app.get('/instructor/my-classes',verifyJWT, verifyInsructor, async(req, res)=>{
            const email = req.query.email;
            const query = {email: email};
            const result = await classesCollection.find(query).toArray();
            
            res.send(result)
        })


        //ADMIN     related api
        app.get('/admin/:email', verifyJWT, async(req, res)=>{
            const email = req.params.email;
            const query = {email: email};
            const user = await userCollection.findOne(query);

            const result = {admin: user?.role === 'admin'};
            res.send(result)
        })


        //get selected class

        app.get('/selected-class', async (req, res) => {
            const email = req.query.email;
            const query = { studentEmail: email }
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result)
        })

        //get payment class
        app.get('/payment/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.findOne(query);
            res.send(result)
        })

        //create-payment-intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']

            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //save payment data
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertResult = await paymentCollection.insertOne(payment);

            const query = { _id: new ObjectId(payment.selectedClassId) };
            const deleteResult = await selectedClassCollection.deleteOne(query);

            const querySeats = { _id: new ObjectId(payment.classesId) };
            const option = { $inc: { availableSeats: -1, students: 1 } };
            const availableSeatsResult = await classesCollection.updateOne(querySeats, option);

            res.send({ insertResult, deleteResult, availableSeatsResult })
        })





        //get my classes data form payment database
        app.get('/my-classes', verifyJWT, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).sort({ date: -1 }).toArray();
            res.send(result)
        })

        //post
        //selected class add 
        app.post('/selected-classes', async (req, res) => {
            const classData = req.body;
            const result = await selectedClassCollection.insertOne(classData);
            res.send(result)
        })

        //DELETE
        //delete selected class
        app.delete('/selected-classes/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('camping is running')
})


app.listen(port, () => {
    console.log('camp running on port:', port)
})