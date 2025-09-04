import { WebSocketGateway, WebSocketServer, OnGatewayConnection } from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
    cors: { origin: "*" },
})
export class ChangesGateway implements OnGatewayConnection {
    @WebSocketServer()
    server: Server;


    userSockets: Record<string, string> = {};



    handleConnection(client: any) {
        const userId = client.handshake.query.userId as string;

        if (userId) {
            this.userSockets[userId] = client.id;
        }
    }

    sendNewTransaction(transaction: any, siteID: any) {
        this.server.emit("newTransaction", siteID);
    }


    sendTableAltered(tableId: string, siteID: number) {
        this.server.emit('tableAltered', tableId, siteID);

    }
    sendSiteAltered(siteID: number) {
        this.server.emit('siteAltered', siteID);

    }


    sendUserPermissionsAltered(userID: number) {
        this.server.emit('usersPermissionsAltered', userID);

    }

}
