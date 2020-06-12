//The main hub for the bot, more comments coming soon.
//Most of the commands are labeled apprioriately so far. More organization coming soon.
const Discord = require('discord.js')
const client = new Discord.Client()

const deckObj = require('./objects/Deck')
const gameObj = require('./objects/Game')
const leagueObj = require('./objects/League')
const seaonObj = require('./objects/Season')
const userObj = require('./objects/User')

const botListeningPrefix = "!";

const Module = require('./mongoFunctions')
const generalID = require('./constants')
const moongoose = require('mongoose')
const url = 'mongodb+srv://firstuser:e76BLigCnHWPOckS@cluster0-ebhft.mongodb.net/UserData?authSource=admin&replicaSet=Cluster0-shard-0&readPreference=primary&appname=MongoDB%20Compass&ssl=true'

moongoose.connect(url, { useNewUrlParser: true, useUnifiedTopology: true });

client.on('ready', (on) =>{
    console.log("Debug log: Successfully connected as " + client.user.tag)
    client.user.setPresence({
        game: { 
            name: 'my code',
            type: 'WATCHING'
        },
        status: 'online'
    })
    
    //Lists out the "guilds" in a discord server, these are the unique identifiers so the bot can send messages to server channels
    // client.guilds.cache.forEach((guild) => {
    //     console.log(guild.name)
    //     guild.channels.cache.forEach((channel) =>{
    //         console.log(` - ${channel.name} ${channel.type} ${channel.id}`)
    //     })
    // })
    // client.user.setUsername("PWP Bot"); 
})
client.on('message', (receivedMessage) =>{
    if (receivedMessage.author == client.user){
        return 
    }
    if (receivedMessage.mentions.users == client.user){
        let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
        generalChannel.channel.send("text")
    }
    if (receivedMessage.content.startsWith(botListeningPrefix) && receivedMessage.channel == (client.channels.cache.get(generalID.getGeneralChatID()))){
        processCommand(receivedMessage)
    }
    else{
        let currentChannel =  client.channels.cache.get()
    }
})
function processCommand(receivedMessage){
    let fullCommand = receivedMessage.content.substr(1)
    let splitCommand = fullCommand.split(" ")
    let primaryCommand = splitCommand[0]
    let arguments = splitCommand.slice(1)

    switch(primaryCommand){
        case "help":
            helpCommand(receivedMessage, arguments)
            break;
        case "register":
            register(receivedMessage, arguments)
            break;
        case "users":
            users(receivedMessage, arguments)
            break;
        case "log":
            //logLosers(receivedMessage, arguments)
            //logMatch(receivedMessage, arguments)
            startMatch(receivedMessage, arguments)
            break;
        case "profile":
            profile(receivedMessage, arguments)
            break;
        case "adddeck":
            addDeck(receivedMessage, arguments)
            break;
        case "credits":
            credits(receivedMessage, arguments)
            break;
        default:
            receivedMessage.channel.send(">>> Unknown command. Try '!help'")
    }
}
function addDeck(receivedMessage, args){
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    Module.addDeckList(receivedMessage, args);
    generalChannel.send(">>> Listed decklist in console")
}
function profile(receivedMessage, args){
    // @TODO
    // Send this information in a nicer format to discord
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    Module.profile(receivedMessage, args);
    generalChannel.send(">>> Listed profile in console")
}
async function logLosers(receivedMessage, args){
    var callBackArray = new Array();
    //var lostEloArray = new Array();
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())

    Module.logLosers(args, function(callback,err){
        callback.forEach(item => {
            callBackArray.push(item)
        });
        generalChannel.send(">>> " + callback[0] + " upvote to confirm this game. Downvote to contest. Make sure to $use <deckname> before reacting.")
        .then(function (message, callback){
            const filter = (reaction, user) => {
                return ['👍', '👎'].includes(reaction.emoji.name) && user.id !== message.author.id;
            };   

            message.react("👍")
            message.react("👎")
            // @TODO: 
            // Look into time of awaitReactions (configurable?)
            // Log points only after upvotes are seen. Right now we are logging THEN checking upvotes
            message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
                .then(collected => {
                    const reaction = collected.first();

                    if (reaction.emoji.name === '👍') {
                        receivedMessage.reply("received confirmation for logging");
                        //console.log(reaction.users)
                    }
                    else {
                        receivedMessage.reply('received contest on game. Please resolve issue then log game again.');
                        return
                    }
                })
        })
        callback.shift()
        // Module.logWinners(receivedMessage, callback, function(callback, err){
        //     //console.log(callback)
        // })
        
    })
   
}
function startMatch(receivedMessage, args){
    const user = require('./Schema/Users')
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())

    const UserIDs = new Array()

    //Generates random 8 char string
    let s4 = () => {
        return Math.floor((1 + Math.random()) * 0x10000000).toString(16).substring(1);
    }
    let id = s4() + s4()

    // Check to make sure the right amount of users tagged
    if (args.length < 3 || args.length > 3) {
        generalChannel.send(">>> **Error**: Submit only the 3 players who lost in the pod")
        return
    }

    // Check if User who sent the message is registered
    let sanitizedString = "<@!"+receivedMessage.author.id+">"
    let findQuery = {'_id': sanitizedString}
    user.findOne(findQuery, function(err, res){
        if (res){
            UserIDs.push(sanitizedString)
            console.log("Winner Found")

            // Check if Users tagged are registered
            let ConfirmedUsers = 0
            args.forEach(loser =>{
                let findQuery = {_id: loser.toString()}
                user.findOne(findQuery, function(err, res){
                    if (res){
                        console.log("Loser Found")
                        UserIDs.push(loser)
                        ConfirmedUsers++
                        if (ConfirmedUsers == 3){
                            // Double check UserID Array then create match and send messages
                            if (UserIDs.length != 4){
                                console.log("Not enough Players")
                                return
                            }
                            else{
                                gameObj.createMatch(UserIDs[0], UserIDs[1], UserIDs[2], UserIDs[3], id, function(cb, err){
                                    if (cb == "FAILURE"){
                                        console.log("Game creation failed")
                                        return
                                    }
                                    else {
                                        console.log("Game Created")
                                        UserIDs.forEach(player => {
                                            findQuery = {'_id': player}
                                            user.findOne(findQuery, function(err, res){
                                                generalChannel.send(">>> Game ID: " + id + " - " + res._id + " upvote to confirm this game. Downvote to contest. Make sure to $use <deckname> before reacting.")
                                                    .then(function (message, callback){
                                                    const filter = (reaction, user) => {
                                                        return ['👍', '👎'].includes(reaction.emoji.name) && user.id !== message.author.id;
                                                    };   

                                                    message.react("👍")
                                                    message.react("👎")
                                                })
                                            })
                                        })
                                    }
                                })
                            }
                        }
                    }
                    else{
                        console.log("Loser not found")
                        console.log(loser)
                        return
                    }
                })
            })
        }
        else{
            console.log("Winner not found")
            console.log(sanitizedString)
            return
        }
    })
}

function logMatch(receivedMessage, args){
    const user = require('./Schema/Users')
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    let arg
    callbackArr = new Array()
    cbArr = new Array()

    if (args.length < 3 || args.length > 3) {
        generalChannel.send(">>> **Error**: Submit only the 3 players who lost in the pod")
        return
    }

    args.forEach(loser =>{
        let findQuery = {_id: loser.toString()}
        console.log(findQuery)
        user.findOne(findQuery, function(err, res){
            if (res){
                generalChannel.send(">>> " + res._id + " upvote to confirm this game. Downvote to contest. Make sure to $use <deckname> before reacting.")
                    .then(function (message, callback){
                    const filter = (reaction, user) => {
                        return ['👍', '👎'].includes(reaction.emoji.name) && user.id !== message.author.id;
                    };   

                    message.react("👍")
                    message.react("👎")

                    message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
                        .then(collected => {
                        const reaction = collected.first();

                        if (reaction.emoji.name === '👍') {
                            console.log(reaction.author)
                            generalChannel.send(loser + " received confirmation for logging");
                            arg = res._id.toString()
                            gameObj.logLoser(arg, function(cb, err){
                                cbArr.push(cb)
                                if (cb == "Error: FAIL"){
                                    callbackArr.push("Error: FAIL " + " " + loser)
                                }
                                else if (cb == "Error: NO-REGISTER"){
                                    callbackArr.push("Error: NO-REGISTER " + " " + loser)
                                }
                                else {
                                    callbackArr.push("LOSS: " + loser + ":" + " Current Points: " + cb)
                                    if (callbackArr.length == 4){
                                        callbackArr.forEach(cb => {
                                                generalChannel.send(">>> " + cb)
                                            });
                                        }
                                }
                            })
                        }
                        else {
                            receivedMessage.reply('received contest on game. Please resolve issue then log game again.');
                            return
                        }
                    }).catch(collected => {
                        return
                    })
                })
            }
            else {
                callbackArr.push("USER NOT FOUND ", + " " + loser)
            }
        })
    });
    arg = receivedMessage.author.id.toString()
    gameObj.logWinner(arg, function(cb, err){
        cbArr.push(cb)
        if (cb == "Error: FAIL"){
            callbackArr.push("Error: FAIL " + " " + receivedMessage.author.id)
        }
        else if (cb == "Error: NO-REGISTER"){
            callbackArr.push("Error: NO-REGISTER " + " " + receivedMessage.author.id)
        }
        else {
            let sanitizedString = "<@!"+receivedMessage.author.id+">"
            generalChannel.send(">>> " + sanitizedString + " upvote to confirm this game. Downvote to contest. Make sure to $use <deckname> before reacting.")
            .then(function (message, callback){
                const filter = (reaction, user) => {
                    return ['👍', '👎'].includes(reaction.emoji.name) && user.id !== message.author.id;
                };   

                message.react("👍")
                message.react("👎")
                // @TODO: 
                // Look into time of awaitReactions (configurable?)
                // Log points only after upvotes are seen. Right now we are logging THEN checking upvotes
                message.awaitReactions(filter, { max: 1, time: 60000, errors: ['time'] })
                    .then(collected => {
                        const reaction = collected.first();

                        if (reaction.emoji.name === '👍') {
                            generalChannel.send(sanitizedString + " received confirmation for logging");
                            callbackArr.push("WIN: " + sanitizedString + ":" + " Current Points: " + cb)
                            if (callbackArr.length == 4){
                                callbackArr.forEach(cb => {
                                        generalChannel.send(">>> " + cb)
                                    });
                            }
                        }
                        else {
                            receivedMessage.reply('received contest on game. Please resolve issue then log game again.');
                            return
                        }
                    })
            })
        }
    })
}
function users(receivedMessage, args){
    /* @TODO
    This function can be useful for other aspects of the project, it should be converted to a general count function. ATM it only 
    counts the number of documents in the user collection, but it can be expanded to a lot more.
    */
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    Module.listAll(receivedMessage, function(callback, err){
        generalChannel.send(">>> There are " + callback + " registered users in this league.")
    })
}
function register(receivedMessage, args){
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    leagueObj.register(receivedMessage, function(callback,err){
        //Case 1: User is not registered and becomes registered
        if (callback == "1"){ 
            generalChannel.send(">>> " + receivedMessage.author.username + " is now registered.")
        }
        //Case 2: User is already registered and the bot tells the user they are already registered
        else{
            generalChannel.send(">>> " + receivedMessage.author.username + " is already registered.")
        }
    })
}
function helpCommand(receivedMessage, arguments){
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    if (arguments.length == 0){
        const exampleEmbed = new Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle('PWP Bot')
        .setURL('')
        .setAuthor('Noah Saldaña', '', '')
        .setDescription('An excellent bot for excellent people')
        .setThumbnail('')
        .addFields(
            { name: '!help', value: 'Where you are now. A list of all available commands with a brief description of each.' },
            { name: '\u200B', value: '\u200B' },
            { name: '!multiply', value: 'Multiply two numbers.', inline: true },
            { name: '!send', value: 'Bot will tell your friends what you really think of them.', inline: true },
            { name: '!log', value: 'Testing function, adds elo to an account. ', inline: true },
            /* @TODO
                Add other commands manually or find a way to programmatically list all commands available + a blurb
            */
        )
        .setImage('')
        .setTimestamp()
        .setFooter('Some footer text here', '');
    
    generalChannel.send(exampleEmbed);
    } else{
        receivedMessage.channel.send("It looks like you need help with " + arguments)

        //@TODO
        //  Take argument user has mentioned and spit back information on it. EX: user types: !help test. Spit back information about test command.
    }
}
function credits(argument, receivedMessage){
    /* @TODO
        Give credit where credit is due 
    */
}
client.login("NzE3MDczNzY2MDMwNTA4MDcy.XtZgRg.k9uZEusoc7dXsZ1UFkwtPewA72U")





//Outdated or old testing commands. Not commented out so they can be collapsed.

//Sends a message to a user. Mention them and then your message and the bot will
//   take the mentioned person and repeat your message to them
function sendMessage(arguments, receivedMessage){
    let generalChannel = client.channels.cache.get(generalID.getGeneralChatID())
    let count = 0
    msg = receivedMessage.content.toLowerCase();
    mention = receivedMessage.mentions.users
    if (mention == null){ return; }
    if (msg.startsWith (prefix + "send")){
        mention.forEach((users) => {
            count++;
        }) 
    }
    if (count > 1){ 
        generalChannel.send(">>> Error, try again and only mention 1 person.")
        generalChannel.send(">>> Try: !send @Username Hello my dear friend!")
        return; 
    }
    else{
        mention.forEach((users) => {
            let fullMessage =  receivedMessage.content.substr(6)
            let splitCommand = fullMessage.split(" ")
            let mentionedAndMessage = splitCommand.slice(1)
            let finishedString = mentionedAndMessage.join(" ");
            generalChannel.send(">>> **psst " + users.toString() + " " + receivedMessage.author.toString() + " says: **")
            generalChannel.send(">>> " + finishedString)
        }) 
    }
}
//Multiplies two numbers. Tutorial stuff 
function multiplyCommand(arguments, receivedMessage){
    if (arguments.length < 2){
        receivedMessage.channel.send("Not enough arguments. Try '!multiply 2 10'")
        return
    }
    let product = 1
    arguments.forEach((value) =>{
        product = product * parseFloat(value)
    })
    receivedMessage.channel.send("The product of " + arguments + " is " + product.toString())
}