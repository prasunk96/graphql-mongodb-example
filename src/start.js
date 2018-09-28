import {MongoClient, ObjectId} from 'mongodb'
import express from 'express'
import bodyParser from 'body-parser'
import {graphqlExpress, graphiqlExpress} from 'graphql-server-express'
import {makeExecutableSchema} from 'graphql-tools'
import cors from 'cors'
import {prepare} from "../utill/index"


const app = express()

app.use(cors())

const homePath = '/graphiql'
const URL = 'http://localhost'
const PORT = 8080
const MONGO_URL = 'mongodb://localhost:27017/blog-app'



export const start = async () => {
  try {
    const db = await MongoClient.connect(MONGO_URL)

    const Posts = db.collection('posts')
    const Comments = db.collection('comments')

    const typeDefs = [`
      type Query {
        post(_id: String): Post
        posts: [Post]
        comment(_id: String): Comment
        comments: [Comment]
      }

      type Post {
        _id: String
        title: String
        content: String
        img: String
        comments: [Comment]
      }

      type Comment {
        _id: String
        postId: String
        content: String
        post: Post
      }

      type Mutation {
        createPost(title: String, content: String, img: String): Post
        createComment(postId: String, content: String): Comment
        deletePost(_id: String) : Post
        deleteComment(_id: String): Comment
        updatePost(_id: String, title: String, content: String, img: String): Post
      }

      schema {
        query: Query
        mutation: Mutation
      }
    `];

    const resolvers = {
      Query: {
        post: async (root, {_id}) => {
          return prepare(await Posts.findOne(ObjectId(_id)))
        },
        posts: async () => {
          return (await Posts.find({}).toArray()).map(prepare)
        },
        comment: async (root, {_id}) => {
          return prepare(await Comments.findOne(ObjectId(_id)))
        },
        comments: async () => {
          return (await Comments.find({}).toArray()).map(prepare)
        }
      },
      Post: {
        comments: async ({_id}) => {
          return (await Comments.find({postId: _id}).toArray()).map(prepare)
        }
      },
      Comment: {
        post: async ({postId}) => {
          return prepare(await Posts.findOne(ObjectId(postId)))
        }
      },
      Mutation: {
        createPost: async (root, args, context, info) => {
          const res = await Posts.insertOne(args)
          return prepare(await Posts.findOne({_id: res.insertedId}))
        },
        createComment: async (root, args) => {
          const res = await Comments.insertOne(args)
          return prepare(await Comments.findOne({_id: res.insertedId}))
        },
        deletePost: async (root, args, context, info) => {
          const res = prepare(await Posts.findOne(ObjectId(args._id)))
          await Posts.findOneAndDelete({_id: ObjectId(args._id)})
          return res;
        },
        deleteComment: async (root, args, context, info) => {
          const res = prepare(await Comments.findOne(ObjectId(args._id)))
          await Comments.findOneAndDelete({_id:ObjectId(args._id)})
          return res;
        },
        updatePost: async (root, args, context, info) => {
          await Posts.findOneAndUpdate({_id:ObjectId(args._id)}, {$set:{"title":args.title, "content":args.content, "img":args.img}}, {returnNewDocument:true})
          const res = prepare(await Posts.findOne(ObjectId(args._id)))
          return res;
        }
      },
    }

    const schema = makeExecutableSchema({
      typeDefs,
      resolvers
    })


    app.use('/graphql', bodyParser.json(), graphqlExpress({schema}))


    app.use(homePath, graphiqlExpress({
      endpointURL: '/graphql'
    }))

    app.listen(PORT, () => {
      console.log(`Visit ${URL}:${PORT}${homePath}`)
    })

  } catch (e) {
    console.log(e)
  }

}
