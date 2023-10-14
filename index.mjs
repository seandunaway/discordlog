#!/usr/bin/env node

import {parseArgs} from 'node:util'


// usage

let {values: args} = parseArgs({options: {
    auth: {short: 'a', type: 'string'},
    channels: {short: 'c', type: 'string'},
    users: {short: 'u', type: 'string'},
    keywords: {short: 'k', type: 'string'},
    translate: {short: 't', type: 'boolean'},
    limit: {short: 'l', type: 'string', default: '100'},
    poll: {short: 'p', type: 'string', default: '60'},
    help: {short: 'h', type: 'boolean'},
}})

let channels = args.channels?.split(/[\s,]+/) ?? []
let users = args.users?.split(/[\s,]+/) ?? []
let keywords = args.keywords?.split(/[\s,]+/) ?? []
let limit = parseInt(/** @type {string} */ (args.limit))
let poll = parseInt(/** @type {string} */ (args.poll)) * 1000

if (!args.auth || !channels || args.help) {
    console.error('usage:')
    console.error('--auth | -a <discord_auth> (required)')
    console.error('--channels | -c <channel_ids> (required)')
    console.error('--users | -u <user_ids | usernames>')
    console.error('--keywords | -k <keywords>')
    console.error('--translate | -t')
    console.error('--limit | -l <fetches>')
    console.error('--poll | -p <seconds>')
    console.error('--help | -h')
    process.exit(1)
}


// loop

let last_timestamp = {}
let channel_name = {}

while (true) {
    for (let channel of channels) {


        // fetch messages

        let response = await fetch(`https://discord.com/api/v9/channels/${channel}/messages?limit=${limit}`, {
            headers: {'authorization': args.auth}
        })
        let json = await response.json()

        let messages = []
        for (let i = json.length - 1; i >= 0; i--) {
            let message = json[i]
            let timestamp = new Date(message.timestamp).getTime()

            if (!message.content) continue
            if (timestamp <= last_timestamp[message.channel_id]) continue

            messages.push({
                timestamp,
                channel_id: message.channel_id,
                channel_name: undefined,
                username: message.author.global_name,
                content: message.content,
                content_translated: '',
                filtered: true,
            })

            last_timestamp[message.channel_id] = timestamp
        }


        // mutate

        for (let i in messages) {


            // fetch channel_name

            if (channel_name[messages[i].channel_id]) {
                messages[i]['channel_name'] = channel_name[messages[i].channel_id]
                continue
            }

            let response = await fetch(`https://discord.com/api/v9/channels/${channel}`, {
                headers: {'authorization': args.auth}
            })
            let json = await response.json()

            channel_name[messages[i].channel_id] = json.name
            messages[i]['channel_name'] = json.name


            // filter users

            let message_username = messages[i].username.toLowerCase()

            for (let user of users) {
                let args_username = user.toLowerCase()

                if (message_username.includes(args_username))
                    messages[i].filtered = false
            }


            // filter keywords

            let message_content = messages[i].content.toLowerCase()

            for (let keyword of keywords) {
                let args_keyword = keyword.toLowerCase()

                if (message_content.includes(args_keyword))
                    messages[i].filtered = false
            }


            // translate

            if (args.translate) {
                messages[i].content_translated = `translated: ${messages[i].content}`
            }
        }


        // output

        for (let message of messages) {
            if (message.filtered) continue
            console.info(`[${message.channel_name}:${message.username}] ${message.content_translated || message.content}`)
        }


        // sleep

        await new Promise(function (resolve) {setTimeout(resolve, poll)})
    }
}
