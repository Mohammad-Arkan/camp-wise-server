const express = require('express');
const cors = require('cors')
require('dotenv').config();
const jwt = require('jsonwebtoken');


const app = express();
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())

//jwt verify middleware
const verifyJWT = (req, res, next)=>{
    const authorization = req.headers.authorization;
    if(!authorization){
        return res.status(401).send({error: true, message: "unouthorized access"});
    }

    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded)=>{
        if(err){
            res.status(401).send({error: true, message: 'unouthorized access'})
        }
        req.decoded = decoded;
        next()
    })
}




const { MongoClient, ServerApiVersion } = require('mongodb');
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

        const instructorCollection = client.db('Summer-Camp').collection('instructor');
        const popularClassCollection = client.db('Summer-Camp').collection('Popularclass');
        const classesCollection = client.db('Summer-Camp').collection('classes');
        const selectedClassCollection = client.db('Summer-Camp').collection('SelectedClasses');



        //JWT
        app.post('/jwt', (req, res)=>{
            const email = req.body;
            const token = jwt.sign(email, process.env.JWT_SECRET, {expiresIn: '1h'})
            res.send({token})
            
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


        //get selected class
        
        app.get('/selected-class', async(req, res)=>{
            const email = req.query.email;
            const query = {studentEmail: email}
            const result = await selectedClassCollection.find(query).toArray();
            res.send(result)
        })

        //post
        //selected class add 
        app.post('/selected-classes', async (req, res) => {
            const classData = req.body;
            const result = await selectedClassCollection.insertOne(classData);
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