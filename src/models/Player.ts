import {Property} from "./Property";
import {Stadium} from "./Stadium";
import {Dealership} from "./Dealership";
import {ClubService} from "./ClubService";
import {BoxPosition, PropertyType} from "@/types";

export class Player {
    name: string;
    pos: number;
    money: number;
    turns: number;
    sanctioned: boolean;
    appeal: boolean;
    doubles: boolean;
    bankrupt: boolean;
    properties: Array<Property>;

    constructor(name = '', money = 150000) {
        this.name = name;
        this.pos = 1;
        this.money = money;
        this.turns = 3;
        this.sanctioned = false;
        this.appeal = false;
        this.doubles = false;
        this.bankrupt = false;
        this.properties = [];
    }

    position(dice1: number, dice2: number): void {
        this.turns--;
        this.doubles = dice1 == dice2;
        this.pos += dice1 + dice2;
        if (this.pos > BoxPosition.LAST_BOX) {
            this.passedStart();
            this.pos -= BoxPosition.LAST_BOX;
        }
    }

    move(position: number): void {
        this.pos = position < 0 ? this.pos + position : position;
        if (this.pos === BoxPosition.BENCH) {
            this.sanctioned = true;
        }
        if (this.pos > BoxPosition.LAST_BOX) {
            this.passedStart();
            this.pos -= BoxPosition.LAST_BOX;
        }
    }

    isPropertyOwned(property: Property): boolean {
        return this.properties.find(p => p.id === property.id) != undefined;
    }

    passedStart(): void {
        if (!this.sanctioned) {
            this.receive(20000);
        }
    }

    mortgage(property: Property): void {
        if (property instanceof Stadium) {
            if (!property.mortgaged && property.chairs == 0) {
                this.receive(property.mortgage);
                property.mortgaged = true;
            }
        } else {
            if (!property.mortgaged) {
                this.receive(property.mortgage);
                property.mortgaged = true;
            }
        }
    }

    redeem(property: Property): void {
        if (property.mortgaged) {
            this.pay(property.mortgageTotal);
            property.mortgaged = false;
        }
    }

    hasGroup(stadium: Stadium): boolean {
        return !stadium.mortgaged && this.properties.filter(p => p instanceof Stadium && p.team.includes(stadium.team)).length == 2;
    }

    buyChair(stadium: Stadium, qty: number): boolean {
        const amount = stadium.build * qty;
        const isViable = this.checkViabilityStadiumWithAmount(stadium, amount);
        if (isViable) {
            stadium.buildAction(qty);
            this.pay(amount);
        }
        return isViable;
    }

    sellChair(stadium: Stadium, qty: number): boolean {
        const amount = stadium.build * qty * 0.5;
        const isViable = this.checkViabilityStadium(stadium);
        if (isViable) {
            stadium.teardown(qty);
            this.money += amount;
        }
        return isViable;
    }

    buyProperty(property: Property): void {
        if (!property.mortgaged && !this.isPropertyOwned(property) && this.money >= property.price) {
            this.pay(property.price);
            this.properties.push(property);
        }
    }

    sellProperty(property: Property): void {
        const owned = this.isPropertyOwned(property);
        if (owned) {
            this.money += property.price;
            const index = this.properties.findIndex(p => p == property);
            this.properties.splice(index, 1);
        }
    }

    buildRepairs(cPenalty: number, tPenalty: number): number {
        let chairs = 0, tribune = 0;
        this.properties.forEach(property => {
            if (property instanceof Stadium) {
                if (property.chairs < 5) {
                    chairs += property.chairs;
                } else {
                    tribune++;
                }
            }
        });
        return (chairs * cPenalty) + (tribune * tPenalty);
    }

    private checkViabilityStadiumWithAmount(stadium: Stadium, amount: number): boolean {
        const s = this.fromGroupGetStadium(stadium);
        return stadium.chairs <= 5 && amount < this.money && this.checkBuildingEquity(stadium, s);
    }

    private checkViabilityStadium(stadium: Stadium): boolean {
        const s = this.fromGroupGetStadium(stadium);
        return stadium.chairs > 0 && this.checkTeardownEquity(stadium, s);
    }

    private checkViability(property: Property): boolean {
        return this.money - property.price > 0;
    }

    private fromGroupGetStadium(stadium: Stadium): Stadium {
        return this.properties.find(p => p instanceof Stadium && p.team === stadium.team && p.id !== stadium.id) as Stadium;
    }
    private checkBuildingEquity(current: Stadium, other: Stadium): boolean {
        const aux = current.chairs + 1;
        return current.chairs === 0 || aux - other.chairs == 1 || aux == other.chairs;
    }
    private checkTeardownEquity(current: Stadium, other: Stadium): boolean {
        const aux = current.chairs - 1;
        return other.chairs - aux == 1 || aux == other.chairs;
    }

    trade(incoming: Array<Property>, earned: number, outgoing: Array<Property>, paid: number): void {
        this.receive(earned);
        this.properties.push(...incoming);
        this.pay(paid);
        outgoing.forEach((p: Property) => {
            const index = this.properties.findIndex((pr: Property) => pr.name === p.name);
            this.properties.splice(index, 1);
        });
    }

    getRentStadium(stadium: Stadium): number {
        return stadium.rent(this.hasGroup(stadium));
    }

    getRentDealership(dealership: Dealership): number {
         return dealership.rent(this.getDealerShipOrClubServices(dealership));
    }

    getRentClubServices(clubservice: ClubService, dices: number): number {
        return clubservice.rent(this.getDealerShipOrClubServices(clubservice), dices);
    }

    pay(money: number): void {
        this.money -= money;
        this.bankrupt = this.money < 0;
    }

    receive(money: number): void {
        this.money += money;
    }

    getDealerShipOrClubServices(property: Property): number {
        let result = 0;
        if (property instanceof Dealership) {
            result = this.properties.filter(p => p.type == PropertyType.DEALERSHIP && !p.mortgaged).length;
        } else if (property instanceof ClubService) {
            result = this.properties.filter(p => p.type == PropertyType.CLUB_SERVICES && !p.mortgaged).length;
        }
        console.log('dealership or clubservices ' + result)
        return result;
    }

    handleAppeal(val: boolean): void {
        this.appeal = val;
    }
}