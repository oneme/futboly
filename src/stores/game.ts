import {defineStore} from "pinia";
import {useLogStore} from "./log";
import {Player} from "@/models/Player";
import federation from "../json/federacion.json";
import surprise from "../json/sorpresa.json";
import {Property} from "@/models/Property";
import {Stadium} from "@/models/Stadium";
import {Dealership} from "@/models/Dealership";
import {ClubService} from "@/models/ClubService";
import {formatCurrency} from "@/utils";
import {Deck} from "@/models/Deck";
import {Federation} from "@/models/Federation";
import {Surprise} from "@/models/Surprise";

export const useGameStore = defineStore('game', {
    state: () => ({
        players: Array<Player>(),
        federationCards: new Deck(federation.map(f => new Federation(f.text, f.action)) as Array<Federation>),
        surpriseCards: new Deck(surprise.map(s => new Surprise(s.text, s.action)) as Array<Surprise>),
        chairs: 32,
        tribunes: 12,
        parking: 0,
        showControl: false,
        turn: new Player(),
    }),
    actions: {
        addPlayer(player: Player) {
            this.players.push(player);
            const logStore = useLogStore();
            logStore.addLog(`Jugador ${player.name} añadido`);
        },
        passTurn(player: Player) {
            this.turn = player;
            const logStore = useLogStore();
            logStore.addLog(`Es el turno de ${player.name}`);
        },
        propertyOwner(property: Property): Player | undefined {
            return <Player>this.players.find(p => p.properties.some(pr => pr.id === property.id));
        },
        propertyRent(property: Property, owner: Player, dices: number): number {
            let rent = 0;
            if (property instanceof Stadium) {
                rent = owner.getRentStadium(property);
            } else if (property instanceof Dealership) {
                rent = owner.getRentDealership(property);
            } else if (property instanceof ClubService) {
                rent = owner.getRentClubServices(property, dices);
            }
            return rent;
        },
        buyProperty(property: Property) {
            if (this.propertyOwner(property) != this.turn) {
                this.turn.buyProperty(property);
                const logStore = useLogStore();
                logStore.addLog(`${this.turn.name} ha comprado ${property.fullName} por ${formatCurrency(property.price)} Ptas.`);
            }
        },
        mortgage(property: Property) {
            this.turn.mortgage(property)
            const logStore = useLogStore();
            logStore.addLog(`${this.turn.name} ha hipotecado ${property.fullName} por ${formatCurrency(property.mortgage)} Ptas.`);
        },
        redeem(property: Property) {
            this.turn.redeem(property);
            const logStore = useLogStore();
            logStore.addLog(`${this.turn.name} ha deshipotecado ${property.fullName} por ${formatCurrency(property.mortgageTotal)} Ptas.`);
        },
        trade(property: Property) {
            console.log('trade')
            const response = prompt(`quieres la propiedad ${property.fullName}?`);
            if (response) {
                const index = this.turn.properties.findIndex(p => p.id === property.id);
                this.turn.properties.splice(index, 1);
                this.turn.receive(parseInt(response));
                const newOwner = this.players.find(player => player.name !== this.turn.name);
                newOwner?.pay(parseInt(response));
                newOwner?.properties.push(property);
            }
        },
        sellChair(value: number, stadium: Stadium) {
            if (this.turn.sellChair(stadium, value)) {
                this.chairs += value;
            }
        },
        sellTribune(value: number) {
            this.tribunes += value
        },
        buyChair(value: number, stadium: Stadium) {
            if (this.chairs > 0) {
                if (this.turn.buyChair(stadium, value)) {
                    this.chairs -= value;
                }
            }
        },
        buyTribune(value: number) {
            this.tribunes -= value
        },
        chargeParking() {
            this.parking += 1000
        },
        finishTurn(player: Player) {
            this.turn.turns = 3;
            this.turn.doubles = false;
            const newPlayer = <Player>this.players.find(p => p.name !== player.name);
            this.passTurn(newPlayer);
        },
        finishTurnSanctioned(player: Player) {
            this.turn.turns--;
            this.turn.doubles = false;
            const newPlayer = <Player>this.players.find(p => p.name !== player.name);
            this.passTurn(newPlayer);
        },
        checkProperty(property: Property, host: Player, dices: number): number {
            const owner = this.propertyOwner(property);
            if (!owner || owner == host) {
                return 0;
            }
            return this.propertyRent(property, owner, dices);
        },
        collectFromEachPlayer(penalty: number): void {
            this.players.forEach(p => {
                p.name !== this.turn.name ? p.pay(penalty) : p.receive(penalty);
            });
        },
        chooseRisk(): void {
            const result = confirm("");
            if (result) {
                this.turn.pay(1000);
            } else {
                this.surpriseCards.takeCard();
            }
        },
    }
})