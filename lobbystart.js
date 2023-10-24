const fs = require('fs')
const config = JSON.parse(fs.readFileSync("./config.json"))
const axios = require('axios')
const WebSocket = require('ws')
const email = config.account['email']
const password = config.account['password']
const mode = config['mode']
let partyId
let lobbyCreated = false
async function sendReq(data,url,auth,get){
  try {
  return await axios.post(
    `${url}`,
    JSON.stringify(data),
    {
      headers: {
        'Authorization': auth
      }
    }
  ).then(res => res.data)
  } catch (err) {
    console.log(err)
  }
}
async function getToken(email,password){
    var data = {"email":email,"password":password,"vars":{"client_version":"99999"}}
    let response = await sendReq(data,"https://dev-nakama.winterpixel.io/v2/account/authenticate/email?create=false&=","Basic OTAyaXViZGFmOWgyZTlocXBldzBmYjlhZWIzOTo=")
    return response.token
}
function getRefreshData(B64){
    B64 = btoa(JSON.stringify(B64))
    return {
        cid: "222",
        party_data_send: {
        party_id: "",
        op_code: 4,
        data: B64
        }
      }
}
async function socket(){
    const token = await getToken(email,password)
    const bearer = "Bearer " + token
    let teamAssignments = {}
    let data2 = {countdown:-1,game_mode:mode,host_is_matchmaking:false,is_counting_down:false,team_assignments:teamAssignments,teams_locked:false}
    const loadData = getRefreshData(data2)
      const startData = {
        cid: "111",
        party_create: {
          open: false,
          max_size: 24
        }
      }
      
    const websocket = new WebSocket("wss://dev-nakama.winterpixel.io/ws?lang=en&status=true&token=" + token)
    websocket.onopen = function(){
        console.log("Opening lobby...")

        websocket.send(JSON.stringify(startData))
    }
    websocket.onmessage = async function(event) {
        let eventData = JSON.parse(event.data)
        //console.log(eventData)
        //Events: [[
        if(eventData.cid === "111" && lobbyCreated === false) {
            console.log(`Changing mode to ${mode}...`)

            partyId = eventData.party.party_id
            loadData.party_data_send.party_id = partyId

            websocket.send(JSON.stringify(loadData))
        }


        if(eventData.cid === "222" && lobbyCreated === false){
            let partyData = await sendReq(JSON.stringify({party_id:partyId}),"https://dev-nakama.winterpixel.io/v2/rpc/winterpixel_generate_lobby_code",bearer)
            let lobbyCode = partyData.payload.split("lobby_code\":")[1].split("}")[0]
            console.log(`
            [Lobby created!]
            Until you join the game on your account, keep this script open to let it accept join requests and close it when you have joined.
            After joining, don't mess with the mode switcher (solos -> teams), or else it will not work.
            == Join code: ${lobbyCode} ==
            == Close Script: CTRL + C`)
            lobbyCreated = true
        }


        if(eventData.party_join_request){
            console.log("Join request received!")
            for(const joinRequest of eventData.party_join_request.presences){

                let acceptData = {
                    cid: "333",
                    party_accept: {
                      party_id: partyId,
                      presence: {
                        persistence: false,
                        session_id: joinRequest.session_id,
                        status: "",
                        username: joinRequest.username,
                        user_id: joinRequest.user_id
                      }
                    }
                }

                websocket.send(JSON.stringify(acceptData))

                teamAssignments[joinRequest.user_id] = 1

                let refreshData = getRefreshData({countdown:-1,game_mode:mode,host_is_matchmaking:false,is_counting_down:false,team_assignments:teamAssignments,teams_locked:false})
                refreshData.party_data_send.party_id = partyId
                websocket.send(JSON.stringify(refreshData))

                console.log("A join request has been accepted!")
            }
        }
        //]] Events
    }


    websocket.onclose = () => {console.log("Connection has ended")}
}
socket()